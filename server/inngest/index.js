import { Inngest } from "inngest";
import User from "../models/User.js";
import Booking from "../models/Booking.js";
import Show from "../models/Show.js";
import sendEmail from "../configs/nodeMailer.js";
import { set } from "mongoose";

// Create a client to send and receive events
export const inngest = new Inngest({ id: "movie-ticket-booking" });

// Inngest Function to save user data to a database
const syncUserCreation = inngest.createFunction(
    {id: 'sync-user-from-clerk'},
    { event: 'clerk/user.created' },
    async ({ event })=>{
        const {id, first_name, last_name, email_addresses, image_url} = event.data
        const userData = {
            _id: id,
            email: email_addresses[0].email_address,
            name: first_name + ' ' + last_name,
            image: image_url
        }
        await User.create(userData)
    }
)

// Inngest Function to delete user from database
const syncUserDeletion = inngest.createFunction(
    {id: 'delete-user-with-clerk'},
    { event: 'clerk/user.deleted' },
    async ({ event })=>{
        
       const {id} = event.data
       await User.findByIdAndDelete(id)
    }
)

// Inngest Function to update user data in database 
const syncUserUpdation = inngest.createFunction(
    {id: 'update-user-from-clerk'},
    { event: 'clerk/user.updated' },
    async ({ event })=>{
        const { id, first_name, last_name, email_addresses, image_url } = event.data
        const userData = {
            _id: id,
            email: email_addresses[0].email_address,
            name: first_name + ' ' + last_name,
            image: image_url
        }
        await User.findByIdAndUpdate(id, userData)
    }
)

// Inngest Function to cancel booking and release seats of show after 10 minutes of booking created if payment is not made
const releaseSeatsAndDeleteBooking = inngest.createFunction(
    {id: 'release-seats-delete-booking'},
    {event: "app/checkpayment"},
    async ({ event, step })=>{
        const tenMinutesLater = new Date(Date.now() + 10 * 60 * 1000);
        await step.sleepUntil('wait-for-10-minutes', tenMinutesLater);

        await step.run('check-payment-status', async ()=>{
            const bookingId = event.data.bookingId;
            const booking = await Booking.findById(bookingId)

            // If payment is not made, release seats and delete booking
            if(!booking.isPaid){
                const show = await Show.findById(booking.show);
                booking.bookedSeats.forEach((seat)=>{
                    delete show.occupiedSeats[seat]
                });
                show.markModified('occupiedSeats')
                await show.save()
                await Booking.findByIdAndDelete(booking._id)
            }
        })
    }
)

// Inngest Function to send email when user books a show
const sendBookingConfirmationEmail = inngest.createFunction(
  { id: "send-booking-confirmation-email" },
  { event: "app/show.booked" },
  async ({ event }) => {
    const { bookingId } = event.data;

    const booking = await Booking.findById(bookingId)
      .populate({
        path: "show",
        populate: { path: "movie", model: "Movie" },
      })
      .populate("user");

    if (!booking) return;

    await sendEmail({
      to: booking.user.email,
      subject: `🎟 Đặt vé đã được xác nhận – ${booking.show.movie.title}`,

      body: `
<div style="background:#f6f6f6;padding:30px;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:600px;margin:auto;background:#ffffff;
              border-radius:14px;overflow:hidden;
              box-shadow:0 6px 20px rgba(0,0,0,0.08);">

    <!-- HEADER -->
    <div style="background:#000;padding:22px;text-align:center;">
      <h1 style="margin:0;color:#F84565;font-size:26px;font-weight:800;">
        QUICKSHOW
      </h1>
      <p style="margin-top:6px;color:#aaa;font-size:13px;">
        Hệ thống đặt vé xem phim trực tuyến
      </p>
    </div>

    <!-- BODY -->
    <div style="padding:26px 30px;color:#333;">
      <h2 style="margin-top:0;color:#F84565;">
        🎟 Đặt vé đã được xác nhận
      </h2>

      <p style="font-size:15px;line-height:1.6;">
        Chào <strong>${booking.user.name}</strong>,
      </p>

      <p style="font-size:15px;line-height:1.6;">
        Đặt vé xem phim
        <strong style="color:#F84565;">
          "${booking.show.movie.title}"
        </strong>
        của bạn đã được xác nhận thành công.
      </p>

      <!-- INFO BOX -->
      <div style="background:#fafafa;border-radius:10px;
                  padding:18px;margin-top:18px;
                  border:1px solid #eee;">
        <p style="margin:6px 0;">
          <strong>📅 Ngày chiếu:</strong>
          ${new Date(booking.show.showDateTime).toLocaleDateString("vi-VN")}
        </p>
        <p style="margin:6px 0;">
          <strong>⏰ Thời gian:</strong>
          ${new Date(booking.show.showDateTime).toLocaleTimeString("vi-VN")}
        </p>
      </div>

      <p style="margin-top:18px;font-size:15px;">
        Chúc bạn có một buổi xem phim thật vui vẻ! 🍿
      </p>

      <p style="font-size:14px;color:#555;">
        Cảm ơn bạn đã tin tưởng và sử dụng dịch vụ của QuickShow.
      </p>

      <p style="margin-top:20px;font-size:14px;">
        Trân trọng,<br/>
        <strong>— Đội ngũ QuickShow</strong>
      </p>
    </div>

    <!-- FOOTER -->
    <div style="background:#000;padding:14px;text-align:center;">
      <p style="margin:0;font-size:12px;color:#999;">
        © 2025 QuickShow Cinema. All rights reserved.
      </p>
    </div>
<div style="text-align:center;margin-top:30px;">
  <p style="font-size:14px;color:#555;">
    🎫 Mã vé điện tử (Demo)
  </p>

  <img 
    src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=FAKE-TICKET"
    alt="QR Code "
    width="180"
    height="180"
    style="border:6px solid #F84565;border-radius:12px;"
  />

  <p style="font-size:12px;color:#777;margin-top:8px;">
    
  </p>
</div>

  </div>
</div>
      `,
    });
  }
);


// Inngest Function to send reminders
const sendShowReminders = inngest.createFunction(
    {id: "send-show-reminders"},
    { cron: "0 */8 * * *" }, // Every 8 hours
    async ({ step })=>{
        const now = new Date();
        const in8Hours = new Date(now.getTime() + 8 * 60 * 60 * 1000);
        const windowStart = new Date(in8Hours.getTime() - 10 * 60 * 1000);

        // Prepare reminder tasks
        const reminderTasks =  await step.run("prepare-reminder-tasks", async ()=>{
            const shows = await Show.find({
                showTime: { $gte: windowStart, $lte: in8Hours },
            }).populate('movie');

            const tasks = [];

            for(const show of shows){
                if(!show.movie || !show.occupiedSeats) continue;

                const userIds = [...new Set(Object.values(show.occupiedSeats))];
                if(userIds.length === 0) continue;

                const users = await User.find({_id: {$in: userIds}}).select("name email");

                for(const user of users){
                    tasks.push({
                        userEmail: user.email,
                        userName: user.name,
                        movieTitle: show.movie.title,
                        showTime: show.showTime,
                    })
                }
            }
            return tasks;
        })

        if(reminderTasks.length === 0){
            return {sent: 0, message: "No reminders to send."}
        }

         // Send reminder emails
         const results = await step.run('send-all-reminders', async ()=>{
            return await Promise.allSettled(
                reminderTasks.map(task => sendEmail({
                    to: task.userEmail,
                    subject: `Reminder: Your movie "${task.movieTitle}" starts soon!`,
                     body: `<div style="font-family: Arial, sans-serif; padding: 20px;">
                            <h2>Hello ${task.userName},</h2>
                            <p>This is a quick reminder that your movie:</p>
                            <h3 style="color: #F84565;">"${task.movieTitle}"</h3>
                            <p>
                                is scheduled for <strong>${new Date(task.showTime).toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata' })}</strong> at 
                                <strong>${new Date(task.showTime).toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata' })}</strong>.
                            </p>
                            <p>It starts in approximately <strong>8 hours</strong> - make sure you're ready!</p>
                            <br/>
                            <p>Enjoy the show!<br/>QuickShow Team</p>
                        </div>`
                }))
            )
         })

         const sent = results.filter(r => r.status === "fulfilled").length;
         const failed = results.length - sent;

         return {
            sent,
            failed,
            message: `Sent ${sent} reminder(s), ${failed} failed.`
         }
    }
)

// Inngest Function to send notifications when a new show is added
const sendNewShowNotifications = inngest.createFunction(
    {id: "send-new-show-notifications"},
    { event: "app/show.added" },
    async ({ event })=>{
        const { movieTitle } = event.data;

        const users =  await User.find({})

        for(const user of users){
            const userEmail = user.email;
            const userName = user.name;

            const subject = `🎬 New Show Added: ${movieTitle}`;
            const body = `<div style="font-family: Arial, sans-serif; padding: 20px;">
                    <h2>Hi ${userName},</h2>
                    <p>We've just added a new show to our library:</p>
                    <h3 style="color: #F84565;">"${movieTitle}"</h3>
                    <p>Visit our website</p>
                    <br/>
                    <p>Thanks,<br/>QuickShow Team</p>
                </div>`;

                await sendEmail({
                    to: userEmail,
                    subject,
                    body,
                })
        }

        return {message: "Notifications sent." }
        
    }
)


export const functions = [
    syncUserCreation,
    syncUserDeletion,
    syncUserUpdation,
    releaseSeatsAndDeleteBooking,
    sendBookingConfirmationEmail,
    sendShowReminders,
    sendNewShowNotifications
];
