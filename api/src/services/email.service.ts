import nodemailer from 'nodemailer';
import { env } from '../config/env';

const transporter = nodemailer.createTransport({
  host: env.smtp.host,
  port: env.smtp.port,
  secure: false,
  auth: {
    user: env.smtp.user,
    pass: env.smtp.pass,
  },
});

/** Send an email */
export const sendEmail = async (
  to: string,
  subject: string,
  html: string,
): Promise<void> => {
  if (!env.smtp.host) {
    console.log(`[Email Mock] To: ${to}, Subject: ${subject}`);
    return;
  }

  await transporter.sendMail({
    from: `"רכישות קבוצתיות" <${env.smtp.user}>`,
    to,
    subject,
    html,
  });
};

/** Send purchase confirmation email */
export const sendPurchaseConfirmation = async (
  email: string,
  productName: string,
  price: number,
): Promise<void> => {
  const html = `
    <div dir="rtl" style="font-family: Arial, sans-serif;">
      <h2>אישור הצטרפות לרכישה קבוצתית</h2>
      <p>הצטרפת בהצלחה לרכישה הקבוצתית של <strong>${productName}</strong></p>
      <p>מחיר נוכחי: <strong>₪${price}</strong></p>
      <p>נעדכן אותך כשהרכישה תיסגר.</p>
      <br/>
      <p>תודה שבחרת ברכישות קבוצתיות!</p>
    </div>
  `;
  await sendEmail(email, `אישור הצטרפות - ${productName}`, html);
};
