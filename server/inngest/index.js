import { Inngest } from "inngest";
import User from "../models/User.js";
import Booking from "../models/Booking.js";
import Show from "../models/Show.js";
import sendEmail from "../configs/nodeMailer.js";

/* ===========================================
   INNGEST CLIENT
=========================================== */
export const inngest = new Inngest({ id: "movie-ticket-booking" });

/* ===========================================
   HELPER — LOAD BOOKING & SHOW
=========================================== */
async function loadBookingSafe(bookingId) {
  const booking = await Booking.findById(bookingId)
    .populate({
      path: "show",
      populate: { path: "movie", model: "Movie" },
    })
    .populate("user");

  if (!booking) {
    console.log("❌ Booking not found:", bookingId);
    return null;
  }

  return booking;
}

/* ===========================================
   1️⃣ SYNC USER WITH CLERK
=========================================== */
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

/* ===========================================
   2️⃣ RELEASE SEATS IF NOT PAID
=========================================== */
const releaseSeatsAndDeleteBooking = inngest.createFunction(
  { id: "release-seats-delete-booking" },
  { event: "app/checkpayment" },
  async ({ event, step }) => {
    const bookingId = event.data.bookingId;

    const tenMinLater = new Date(Date.now() + 10 * 60 * 1000);
    await step.sleepUntil("wait-10-min", tenMinLater);

    const booking = await Booking.findById(bookingId);
    if (!booking) return;

    if (!booking.isPaid) {
      console.log("❌ Payment timeout → release seats");

      const show = await Show.findById(booking.show);
      booking.bookedSeats.forEach((seat) => delete show.occupiedSeats[seat]);

      show.markModified("occupiedSeats");
      await show.save();

      await Booking.findByIdAndDelete(bookingId);
    }
  }
);

/* ===========================================
   📧 SEND EMAIL ALWAYS TO FIXED ADDRESS
=========================================== */
const RECEIVER = "nnnguyenanhkhoa@gmail.com";

/* ===========================================
   3️⃣ EMAIL WHEN BOOKING CREATED
=========================================== */
const sendBookingConfirmationEmail = inngest.createFunction(
  { id: "send-booking-confirmation-email" },
  { event: "app/show.booked" },
  async ({ event }) => {
    const booking = await loadBookingSafe(event.data.bookingId);
    if (!booking) return { skipped: true };

    await sendEmail({
      to: RECEIVER,
      subject: `🟡 NEW BOOKING CREATED — ${booking.show.movie.title}`,
   html: `
<div style="background:#f7f7f7;padding:30px;font-family:Arial,Helvetica,sans-serif;">
  
  <div style="max-width:600px;margin:auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.1);">

    <!-- HEADER -->
    <div style="background:#000;padding:20px;text-align:center;">
      <h1 style="color:#e50914;margin:0;font-size:28px;font-weight:800;letter-spacing:1px;">
        QUICKSHOW CINEMA
      </h1>
    </div>

    <!-- BODY -->
    <div style="padding:25px 30px;color:#333;">
      <h2 style="margin-top:0;font-size:24px;color:#e50914;">🟡 BOOKING CREATED</h2>
      <p style="font-size:16px;line-height:1.6;">
        A new booking has been created but is <strong style="color:#e50914;">not paid yet</strong>.
      </p>

      <!-- INFO BOX -->
      <div style="background:#fafafa;border-radius:10px;padding:20px;margin-top:20px;border:1px solid #eee;">
        <p style="margin:5px 0;font-size:16px;"><strong>🎬 Movie:</strong> ${booking.show.movie.title}</p>
        <p style="margin:5px 0;font-size:16px;"><strong>💺 Seats:</strong> ${booking.bookedSeats.join(", ")}</p>
        <p style="margin:5px 0;font-size:16px;"><strong>👤 User:</strong> ${booking.user?.name} — ${booking.user?.email}</p>
      </div>

      <p style="margin-top:20px;font-size:15px;color:#555;">
        ⏳ Please complete the payment within <strong>10 minutes</strong>.
      </p>

      <!-- QR -->
      <div style="text-align:center;margin-top:25px;">
        <img src="cid:qr" alt="QR Code" width="160" height="160" style="border:6px solid #000;border-radius:12px;">
        <p style="font-size:14px;color:#444;">Scan QR (Fake Example)</p>
      </div>
    </div>

    <!-- FOOTER -->
    <div style="background:#000;padding:15px;text-align:center;">
      <p style="color:#bbb;margin:0;font-size:13px;">© 2025 QuickShow Cinema</p>
    </div>
  </div>
</div>
`

    });

    return { OK: true };
  }
);

/* ===========================================
   4️⃣ EMAIL WHEN PAYMENT SUCCESSFUL
=========================================== */
const sendPaymentSuccessEmail = inngest.createFunction(
  { id: "send-payment-success-email" },
  { event: "app/show.paid" },
  async ({ event }) => {
    const booking = await loadBookingSafe(event.data.bookingId);
    if (!booking) return { skipped: true };

    await sendEmail({
      to: RECEIVER,
      subject: `🟢 PAYMENT SUCCESS — ${booking.show.movie.title}`,
     html: `
<div style="background:#f7f7f7;padding:30px;font-family:Arial,Helvetica,sans-serif;">

  <div style="max-width:600px;margin:auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.1);">

    <!-- HEADER -->
    <div style="background:#000;padding:20px;text-align:center;">
      <h1 style="color:#2ecc71;margin:0;font-size:28px;font-weight:800;letter-spacing:1px;">
        PAYMENT SUCCESS
      </h1>
    </div>

    <!-- BODY -->
    <div style="padding:25px 30px;color:#333;">
      <h2 style="margin-top:0;font-size:24px;color:#2ecc71;">🟢 BOOKING CONFIRMED</h2>

      <p style="font-size:16px;line-height:1.6;">
        Your payment has been successfully completed.  
        Your ticket is now <strong style="color:#2ecc71;">confirmed</strong>.
      </p>

      <!-- INFO BOX -->
      <div style="background:#f0fff4;border-radius:10px;padding:20px;margin-top:20px;border:1px solid #d4f5dd;">
        <p style="margin:5px 0;font-size:16px;"><strong>🎬 Movie:</strong> ${booking.show.movie.title}</p>
        <p style="margin:5px 0;font-size:16px;"><strong>💺 Seats:</strong> ${booking.bookedSeats.join(", ")}</p>
        <p style="margin:5px 0;font-size:16px;"><strong>🕒 Showtime:</strong> ${new Date(booking.show.showDateTime).toLocaleString()}</p>
        <p style="margin:5px 0;font-size:16px;"><strong>👤 User:</strong> ${booking.user?.name} — ${booking.user?.email}</p>
      </div>

      <!-- QR -->
      <div style="text-align:center;margin-top:30px;">
        <img src="cid:qr" alt="QR Code" width="170" height="170" style="border:6px solid #2ecc71;border-radius:12px;">
        <p style="font-size:14px;color:#444;">Present this QR at the cinema</p>
      </div>
    </div>

    <!-- FOOTER -->
    <div style="background:#000;padding:15px;text-align:center;">
      <p style="color:#bbb;margin:0;font-size:13px;">Enjoy your movie 🍿 — QuickShow Cinema</p>
    </div>

  </div>

</div>
`

    });

    return { OK: true };
  }
);

/* ===========================================
   EXPORT ALL FUNCTIONS
=========================================== */
export const functions = [
  syncUserCreation,
  syncUserDeletion,
  syncUserUpdation,
  releaseSeatsAndDeleteBooking,
  sendBookingConfirmationEmail,
  sendPaymentSuccessEmail,
];
