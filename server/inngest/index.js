import { Inngest } from "inngest";
import User from "../models/User.js";
import Booking from "../models/Booking.js";
import Show from "../models/Show.js";
import sendEmail from "../configs/nodeMailer.js";

/* ======================================================
   INNGEST CLIENT
====================================================== */
export const inngest = new Inngest({ id: "movie-ticket-booking" });

/* ======================================================
   EMAIL TEMPLATE (DÙNG CHUNG)
====================================================== */
const emailTemplate = ({ title, color, content, footer }) => `
<div style="background:#f6f6f6;padding:30px;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:620px;margin:auto;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 6px 20px rgba(0,0,0,.08)">

    <!-- HEADER -->
    <div style="background:#000;padding:22px;text-align:center;">
      <h1 style="margin:0;color:${color};font-size:28px;font-weight:800;letter-spacing:1px">
        QUICKSHOW
      </h1>
      <p style="margin-top:6px;color:#aaa;font-size:13px">
        Online Movie Ticket Booking
      </p>
    </div>

    <!-- BODY -->
    <div style="padding:28px 32px;color:#333">
      <h2 style="margin-top:0;color:${color}">${title}</h2>
      ${content}
    </div>

    <!-- FOOTER -->
    <div style="background:#000;padding:14px;text-align:center">
      <p style="margin:0;font-size:12px;color:#999">
        ${footer || "© 2025 QuickShow Cinema. All rights reserved."}
      </p>
    </div>

  </div>
</div>
`;

/* ======================================================
   1️⃣ SYNC USER WITH CLERK
====================================================== */
const syncUserCreation = inngest.createFunction(
  { id: "sync-user-from-clerk" },
  { event: "clerk/user.created" },
  async ({ event }) => {
    const d = event.data;
    await User.create({
      _id: d.id,
      email: d.email_addresses[0].email_address,
      name: `${d.first_name} ${d.last_name}`,
      image: d.image_url,
    });
  }
);

const syncUserDeletion = inngest.createFunction(
  { id: "delete-user-with-clerk" },
  { event: "clerk/user.deleted" },
  async ({ event }) => {
    await User.findByIdAndDelete(event.data.id);
  }
);

const syncUserUpdation = inngest.createFunction(
  { id: "update-user-from-clerk" },
  { event: "clerk/user.updated" },
  async ({ event }) => {
    const d = event.data;
    await User.findByIdAndUpdate(d.id, {
      email: d.email_addresses[0].email_address,
      name: `${d.first_name} ${d.last_name}`,
      image: d.image_url,
    });
  }
);

/* ======================================================
   2️⃣ AUTO CANCEL BOOKING IF NOT PAID (10 MIN)
====================================================== */
const releaseSeatsAndDeleteBooking = inngest.createFunction(
  { id: "release-seats-delete-booking" },
  { event: "app/checkpayment" },
  async ({ event, step }) => {
    const bookingId = event.data.bookingId;

    await step.sleepUntil(
      "wait-10-min",
      new Date(Date.now() + 10 * 60 * 1000)
    );

    const booking = await Booking.findById(bookingId);
    if (!booking || booking.isPaid) return;

    const show = await Show.findById(booking.show);
    booking.bookedSeats.forEach(seat => delete show.occupiedSeats[seat]);

    show.markModified("occupiedSeats");
    await show.save();
    await Booking.findByIdAndDelete(bookingId);
  }
);

/* ======================================================
   3️⃣ EMAIL – BOOKING CONFIRMATION
====================================================== */
const sendBookingConfirmationEmail = inngest.createFunction(
  { id: "send-booking-confirmation-email" },
  { event: "app/show.booked" },
  async ({ event }) => {
    const booking = await Booking.findById(event.data.bookingId)
      .populate({ path: "show", populate: { path: "movie" } })
      .populate("user");

    if (!booking) return;

    await sendEmail({
      to: booking.user.email,
      subject: `🎟 Booking Confirmed – ${booking.show.movie.title}`,
      html: emailTemplate({
        title: "Booking Confirmed",
        color: "#F84565",
        content: `
          <p>Hello <strong>${booking.user.name}</strong>,</p>
          <p>Your booking has been <strong style="color:#F84565">successfully confirmed</strong>.</p>

          <div style="background:#fafafa;border-radius:10px;padding:18px;border:1px solid #eee">
            <p><strong>🎬 Movie:</strong> ${booking.show.movie.title}</p>
            <p><strong>💺 Seats:</strong> ${booking.bookedSeats.join(", ")}</p>
            <p><strong>🕒 Showtime:</strong> ${new Date(
              booking.show.showDateTime
            ).toLocaleString("vi-VN")}</p>
          </div>

          <p style="margin-top:16px">Enjoy your movie 🍿</p>
        `,
      }),
    });
  }
);

/* ======================================================
   4️⃣ EMAIL – SHOW REMINDER (CRON)
====================================================== */
const sendShowReminders = inngest.createFunction(
  { id: "send-show-reminders" },
  { cron: "0 */8 * * *" },
  async ({ step }) => {
    const now = new Date();
    const in8h = new Date(now.getTime() + 8 * 60 * 60 * 1000);

    const shows = await Show.find({
      showTime: { $gte: now, $lte: in8h },
    }).populate("movie");

    for (const show of shows) {
      const userIds = [...new Set(Object.values(show.occupiedSeats || {}))];
      const users = await User.find({ _id: { $in: userIds } });

      for (const user of users) {
        await sendEmail({
          to: user.email,
          subject: `⏰ Reminder – ${show.movie.title}`,
          html: emailTemplate({
            title: "Movie Reminder",
            color: "#FFA500",
            content: `
              <p>Hi <strong>${user.name}</strong>,</p>
              <p>Your movie <strong>${show.movie.title}</strong> will start soon.</p>
              <p><strong>🕒 Time:</strong> ${new Date(
                show.showTime
              ).toLocaleString("vi-VN")}</p>
            `,
          }),
        });
      }
    }
  }
);

/* ======================================================
   5️⃣ EMAIL – NEW SHOW ADDED
====================================================== */
const sendNewShowNotifications = inngest.createFunction(
  { id: "send-new-show-notifications" },
  { event: "app/show.added" },
  async ({ event }) => {
    const users = await User.find({});
    for (const user of users) {
      await sendEmail({
        to: user.email,
        subject: `🎬 New Show Added – ${event.data.movieTitle}`,
        html: emailTemplate({
          title: "New Show Available",
          color: "#2ecc71",
          content: `
            <p>Hello <strong>${user.name}</strong>,</p>
            <p>A new movie show has just been added:</p>
            <h3 style="color:#2ecc71">${event.data.movieTitle}</h3>
            <p>Visit QuickShow to book your tickets now!</p>
          `,
        }),
      });
    }
  }
);

/* ======================================================
   EXPORT
====================================================== */
export const functions = [
  syncUserCreation,
  syncUserDeletion,
  syncUserUpdation,
  releaseSeatsAndDeleteBooking,
  sendBookingConfirmationEmail,
  sendShowReminders,
  sendNewShowNotifications,
];
