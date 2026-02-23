import nodemailer from "nodemailer";

type MailConfig = {
  host?: string;
  port?: number;
  user?: string;
  pass?: string;
  from?: string;
};

function getMailConfig(): MailConfig {
  return {
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined,
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.SMTP_FROM,
  };
}

export function isMailEnabled(): boolean {
  const c = getMailConfig();
  return Boolean(c.host && c.port && c.user && c.pass && c.from);
}

function createTransport() {
  const c = getMailConfig();
  return nodemailer.createTransport({
    host: c.host,
    port: c.port!,
    secure: c.port === 465,
    auth: { user: c.user!, pass: c.pass! },
  });
}

export async function sendEmail(to: string, subject: string, html: string) {
  const c = getMailConfig();
  if (!isMailEnabled()) {
    console.log("[MAIL]", { to, subject }, "(SMTP not configured)");
    return;
  }
  const transporter = createTransport();
  await transporter.sendMail({ from: c.from, to, subject, html });
}

export async function sendOtpEmail(to: string, code: string) {
  const html = `
  <div style="font-family:Arial,sans-serif;line-height:1.6">
    <h2 style="margin:0 0 10px 0;color:#f97316">تحويسة - THOUESA</h2>
    <p>رمز التحقق الخاص بك هو:</p>
    <div style="font-size:28px;font-weight:800;letter-spacing:3px">${code}</div>
    <p style="color:#555;margin-top:12px">ينتهي الرمز خلال 10 دقائق.</p>
    <hr style="border:none;border-top:1px solid #eee;margin:16px 0" />
    <p style="color:#777;font-size:12px">إذا لم تطلب هذا الرمز، تجاهل هذه الرسالة.</p>
  </div>
  `;
  await sendEmail(to, "رمز التحقق - تحويسة (THOUESA)", html);
}

export async function sendOrderStatusEmail(to: string, orderNumber: string, status: string) {
  const html = `
  <div style="font-family:Arial,sans-serif;line-height:1.6">
    <h2 style="margin:0 0 10px 0;color:#f97316">تحويسة - THOUESA</h2>
    <p>تم تحديث حالة طلبك:</p>
    <div><b>رقم الطلب:</b> ${orderNumber}</div>
    <div><b>الحالة الجديدة:</b> ${status}</div>
    <p style="color:#555;margin-top:12px">للاستفسار تواصل معنا عبر واتساب/فيسبوك.</p>
  </div>
  `;
  await sendEmail(to, `تحديث حالة الطلب ${orderNumber}`, html);
}
