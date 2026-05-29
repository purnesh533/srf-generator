import nodemailer from "nodemailer";

let cachedTransporter = null;
let cachedFrom = null;
let usingEthereal = false;

function resolveSmtpHost(email, explicitHost) {
  if (explicitHost) return explicitHost;
  if (process.env.SMTP_HOST) return process.env.SMTP_HOST;

  const domain = String(email || "").split("@")[1]?.toLowerCase() || "";
  if (domain === "gmail.com" || domain === "googlemail.com") {
    return "smtp.gmail.com";
  }
  return "smtp.office365.com";
}

function buildTransportOptions({ user, pass, host }) {
  const smtpHost = resolveSmtpHost(user, host);
  const port = Number(process.env.SMTP_PORT) || 587;
  const secure =
    String(process.env.SMTP_SECURE || "").toLowerCase() === "true" || port === 465;

  return {
    host: smtpHost,
    port,
    secure,
    auth: { user, pass }
  };
}

async function getDefaultTransporter() {
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

export async function sendApprovalEmail({
  to,
  cc,
  subject,
  html,
  attachments,
  smtpAuth
}) {
  let transporter;
  let from;
  let ethereal = false;

  if (smtpAuth?.user && smtpAuth?.pass) {
    transporter = nodemailer.createTransport(buildTransportOptions(smtpAuth));
    from = smtpAuth.from || `"RSi SRF" <${smtpAuth.user}>`;
  } else {
    transporter = await getDefaultTransporter();
    from = cachedFrom;
    ethereal = usingEthereal;
  }

  try {
    const info = await transporter.sendMail({
      from,
      to,
      cc,
      subject,
      html,
      attachments
    });

    const previewUrl = ethereal ? nodemailer.getTestMessageUrl(info) : null;
    return { messageId: info.messageId, previewUrl, usingEthereal: ethereal };
  } catch (error) {
    const msg = String(error?.message || "Failed to send email");
    if (/invalid login|authentication|auth/i.test(msg)) {
      throw new Error(
        "Email login failed. Check your email address and password (use an app password if MFA is enabled)."
      );
    }
    throw error;
  } finally {
    if (smtpAuth?.user) {
      transporter.close();
    }
  }
}
