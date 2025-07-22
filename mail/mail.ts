import { api } from "encore.dev/api";
import { secret } from "encore.dev/config";
import nodemailer from "nodemailer";

const user = secret("USER_MAIL");
const app_password = secret("APP_PASSWORD");

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false, // true for 465, false for 587
  auth: {
    user: user(),
    pass: app_password(),
  },
});

interface mailStructure {
  mail_addr: string;
  subject: string;
  mail_body: string;
  html?: string;
}

// Default Rflect registration HTML template
const htmlTemplate = (otp: string) => `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>Verify your email</title>
    <style>
      body { font-family: sans-serif; background-color: #f9f9f9; margin: 0; padding: 0; }
      .container { max-width: 480px; margin: 40px auto; background: #ffffff; border-radius: 8px; padding: 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
      .footer { font-size: 12px; color: #999999; text-align: center; margin-top: 24px; }
    </style>
  </head>
  <body>
    <div class="container">
      <h2>Verify your email for Rflect</h2>
      <p>Hi,</p>
      <p>Thank you for signing up for Rflect! Please use the OTP below to verify your email address:</p>
      <p style="font-size: 24px; font-weight: bold; letter-spacing: 2px; text-align: center; margin: 24px 0;">${otp}</p>
      <p>This OTP will expire in 10 minutes.</p>
      <p>If you did not request this, you can safely ignore this email.</p>
      <p>Thanks,<br />The Rflect Team</p>
      <div class="footer">
        © ${new Date().getFullYear()} Rflect. All rights reserved.
      </div>
    </div>
  </body>
</html>`;

// Encore export with clean structured response
export const send = api({
  auth: false
}, async ({ mail_addr, mail_body, subject, html }: mailStructure) => {

  // If no HTML provided, generate a clean registration template using mail_body as OTP
  const finalHtml = html ?? htmlTemplate(mail_body);

  const info = await transporter.sendMail({
    from: {
      name: "Rflect",
      address: user()
    },
    to: [mail_addr],
    subject,
    text: mail_body,
    html: finalHtml
  });

  return {
    status: "sent",
    messageId: info.messageId
  };
});
