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

function isOffice365Host(host) {
  const h = String(host || "").toLowerCase();
  return h.includes("office365") || h.includes("outlook");
}

function buildTransportOptions({ user, pass, host, port, secure }) {
  const smtpHost = resolveSmtpHost(user, host);
  const smtpPort = Number(port || process.env.SMTP_PORT) || 587;
  const smtpSecure =
    secure ??
    (String(process.env.SMTP_SECURE || "").toLowerCase() === "true" || smtpPort === 465);

  const options = {
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
    auth: { user, pass },
    connectionTimeout: 12000,
    greetingTimeout: 12000,
    socketTimeout: 20000
  };

  if (isOffice365Host(smtpHost) && !smtpSecure) {
    options.requireTLS = true;
  }

  return options;
}

function getTransportAttempts(smtpAuth) {
  const base = buildTransportOptions(smtpAuth);
  const attempts = [base];

  if (isOffice365Host(base.host) && base.port === 587) {
    attempts.push(
      buildTransportOptions({
        ...smtpAuth,
        port: 465,
        secure: true
      })
    );
  }

  return attempts;
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
    cachedTransporter = nodemailer.createTransport(
      buildTransportOptions({
        user: SMTP_USER,
        pass: SMTP_PASS,
        host: SMTP_HOST,
        port: SMTP_PORT,
        secure: String(SMTP_SECURE || "").toLowerCase() === "true"
      })
    );
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

async function sendViaSmtp({ smtpAuth, from, to, cc, subject, html, attachments }) {
  const attempts = smtpAuth ? getTransportAttempts(smtpAuth) : [null];
  let lastError = null;

  for (const options of attempts) {
    const transporter = options
      ? nodemailer.createTransport(options)
      : await getDefaultTransporter();

    try {
      const sendPromise = transporter.sendMail({
        from,
        to,
        cc,
        subject,
        html,
        attachments
      });

      const info = await Promise.race([
        sendPromise,
        new Promise((_, reject) => {
          setTimeout(
            () => reject(new Error("SMTP connection timed out after 25 seconds")),
            25000
          );
        })
      ]);

      if (options) transporter.close();
      return info;
    } catch (error) {
      lastError = error;
      if (options) transporter.close();
    }
  }

  throw lastError || new Error("Failed to send email via SMTP");
}

async function sendViaResend({ from, replyTo, to, cc, subject, html }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;

  const ccList = cc
    ? String(cc)
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    : undefined;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: from || process.env.RESEND_FROM || process.env.SMTP_FROM,
      to: Array.isArray(to) ? to : [to],
      cc: ccList?.length ? ccList : undefined,
      reply_to: replyTo || undefined,
      subject,
      html
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.message || "Resend API request failed");
  }

  return { messageId: data.id, usingResend: true };
}

function normalizeEmailError(error) {
  const msg = String(error?.message || "Failed to send email");
  if (/invalid login|authentication|auth/i.test(msg)) {
    return new Error(
      "Email login failed. Check your email address and password (use an app password if MFA is enabled)."
    );
  }
  if (/timed out|ETIMEDOUT|ECONNREFUSED|ESOCKET|SMTP connection timed out/i.test(msg)) {
    return new Error(
      "Could not connect to the mail server. Render Free blocks SMTP ports 587/465 — upgrade to Starter ($7/mo), or ask your admin to set RESEND_API_KEY on the server."
    );
  }
  return error;
}

export async function sendApprovalEmail({
  to,
  cc,
  subject,
  html,
  attachments,
  smtpAuth
}) {
  const from =
    smtpAuth?.from ||
    (smtpAuth?.user
      ? `"RSi SRF" <${smtpAuth.user}>`
      : process.env.SMTP_FROM || process.env.RESEND_FROM || cachedFrom);

  try {
    const info = await sendViaSmtp({
      smtpAuth: smtpAuth?.user ? smtpAuth : null,
      from,
      to,
      cc,
      subject,
      html,
      attachments
    });

    const previewUrl =
      !smtpAuth?.user && usingEthereal ? nodemailer.getTestMessageUrl(info) : null;
    return { messageId: info.messageId, previewUrl, usingEthereal: !smtpAuth?.user && usingEthereal };
  } catch (smtpError) {
    if (process.env.RESEND_API_KEY) {
      try {
        const resendInfo = await sendViaResend({
          from: process.env.RESEND_FROM || process.env.SMTP_FROM || from,
          replyTo: smtpAuth?.user,
          to,
          cc,
          subject,
          html
        });
        if (resendInfo) {
          return {
            messageId: resendInfo.messageId,
            previewUrl: null,
            usingEthereal: false,
            usingResend: true
          };
        }
      } catch (resendError) {
        const smtpMsg = normalizeEmailError(smtpError).message;
        throw new Error(`${smtpMsg} Resend fallback also failed: ${resendError.message}`);
      }
    }

    throw normalizeEmailError(smtpError);
  }
}
