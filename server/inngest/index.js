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

      // ⚠️ QUAN TRỌNG: dùng html, KHÔNG dùng body
      html: `
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
        <p style="margin:6px 0;">
          <strong>💺 Ghế:</strong>
          ${booking.bookedSeats.join(", ")}
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

  </div>
</div>
      `,
    });
  }
);
