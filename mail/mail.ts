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

// // Default Rflect registration HTML template
// const htmlTemplate = (otp: string) => `
// <!DOCTYPE html>
// <html>
//   <head>
//     <meta charset="UTF-8" />
//     <title>Verify your email</title>
//     <style>
//       body { font-family: sans-serif; background-color: #f9f9f9; margin: 0; padding: 0; }
//       .container { max-width: 480px; margin: 40px auto; background: #ffffff; border-radius: 8px; padding: 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
//       .footer { font-size: 12px; color: #999999; text-align: center; margin-top: 24px; }
//     </style>
//   </head>
//   <body>
//     <div class="container">
//       <h2>Verify your email for Rflect</h2>
//       <p>Hi,</p>
//       <p>Thank you for signing up for Rflect! Please use the OTP below to verify your email address:</p>
//       <p style="font-size: 24px; font-weight: bold; letter-spacing: 2px; text-align: center; margin: 24px 0;">${otp}</p>
//       <p>This OTP will expire in 10 minutes.</p>
//       <p>If you did not request this, you can safely ignore this email.</p>
//       <p>Thanks,<br />The Rflect Team</p>
//       <div class="footer">
//         © ${new Date().getFullYear()} Rflect. All rights reserved.
//       </div>
//     </div>
//   </body>
// </html>`;

// Refined Rflect SaaS HTML verification template
const htmlTemplate = (otp: string) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Rflect Email Verification</title>
</head>
<body style="margin:0; padding:0; background-color:#030712; color:#ffffff; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;">

  <div style="max-width:480px; margin:0 auto; padding:40px 24px;">

    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="text-align:center;">
      <tr>
        <td style="padding-bottom:2px;">
          <img src="https://res.cloudinary.com/qntum/image/upload/v1753286792/logo-transparent_pbykdj.png" alt="Rflect Logo" width="240" style="display:block; margin:0 auto;"/>
        </td>
      </tr>
      <tr>
        <td style="font-size:22px; font-weight:600; padding-bottom:16px;">
          Please Verify your Email
        </td>
      </tr>
      <tr>
        <td style="font-size:16px; line-height:1.5; padding-bottom:24px;">
          <p style="margin:0;">Thank you for signing up! Use the OTP below to verify.</p>
        </td>
      </tr>
      <tr>
        <td style="padding:6px 0;">
          <div style="display:inline-block; padding:16px 32px; background-color:#111827; color:#38bdf8; font-size:24px; letter-spacing:4px; font-weight:bold; border-radius:8px;">
            ${otp}
          </div>
        </td>
      </tr>
      <tr>
        <td style="font-size:14px; color:#9ca3af; padding-top:16px;">
          This OTP will expire in 10 minutes.
        </td>
      </tr>
      <tr>
        <td style="font-size:12px; color:#6b7280; padding-top:20px;">
          Developed by 
          <a href="https://www.linkedin.com/in/pritammondal-dev/ target="_blank" style="color:#38bdf8; text-decoration:none;">Pritam Mondal</a>
        </td>
      </tr>
    </table>

  </div>

</body>
</html>

`;


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
