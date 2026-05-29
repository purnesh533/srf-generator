import nodemailer from "nodemailer";

let cachedTransporter = null;
let cachedFrom = null;
let usingEthereal = false;

async function getTransporter() {
  if (cachedTransporter) return cachedTransporter;

  const {
    SMTP_HOST,
    SMTP_PORT,
    SMTP_USER,
    SMTP_PASS,
    SMTP_FROM,
    SMTP_SECURE
  } = process.env;

  if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
    cachedTransporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT) || 587,
      secure: String(SMTP_SECURE || "").toLowerCase() === "true",
      auth: { user: SMTP_USER, pass: SMTP_PASS }
    });
    cachedFrom = SMTP_FROM || SMTP_USER;
    usingEthereal = false;
    return cachedTransporter;
  }

  const testAccount = await nodemailer.createTestAccount();
  cachedTransporter = nodemailer.createTransport({
    host: "smtp.ethereal.email",
    port: 587,
    secure: false,
    auth: { user: testAccount.user, pass: testAccount.pass }
  });
  cachedFrom = `"SRF Bot" <${testAccount.user}>`;
  usingEthereal = true;
  return cachedTransporter;
}

export async function sendApprovalEmail({ to, cc, subject, html, attachments }) {
  const transporter = await getTransporter();
  const info = await transporter.sendMail({
    from: cachedFrom,
    to,
    cc,
    subject,
    html,
    attachments
  });

  const previewUrl = usingEthereal ? nodemailer.getTestMessageUrl(info) : null;
  return { messageId: info.messageId, previewUrl, usingEthereal };
}
