function getFromAddress() {
  const from = process.env.RESEND_FROM?.trim();
  if (!from) {
    throw new Error(
      "RESEND_FROM is not configured. Set RESEND_FROM on the server (e.g. \"RSi SRF <onboarding@resend.dev>\")."
    );
  }
  return from;
}

function ensureResendConfigured() {
  if (!process.env.RESEND_API_KEY?.trim()) {
    throw new Error(
      "RESEND_API_KEY is not configured. Add it to server environment variables."
    );
  }
}

function parseCcList(cc) {
  if (!cc) return undefined;
  const list = String(cc)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return list.length ? list : undefined;
}

function toResendAttachments(attachments) {
  if (!attachments?.length) return undefined;
  return attachments.map((att) => {
    const content =
      Buffer.isBuffer(att.content) ? att.content : Buffer.from(att.content || []);
    return {
      filename: att.filename,
      content: content.toString("base64")
    };
  });
}

function normalizeEmailError(error) {
  const msg = String(error?.message || "Failed to send email");
  if (/RESEND_API_KEY|RESEND_FROM/i.test(msg)) return new Error(msg);
  if (/invalid|unauthorized|forbidden|api key/i.test(msg)) {
    return new Error("Resend rejected the request. Check RESEND_API_KEY and RESEND_FROM.");
  }
  return new Error(msg);
}

export async function sendApprovalEmail({ to, cc, subject, html, attachments }) {
  ensureResendConfigured();
  const from = getFromAddress();
  const ccList = parseCcList(cc);

  const body = {
    from,
    to: Array.isArray(to) ? to : [to],
    subject,
    html,
    cc: ccList,
    attachments: toResendAttachments(attachments)
  };

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw normalizeEmailError(
      new Error(data?.message || data?.error || "Resend API request failed")
    );
  }

  return { messageId: data.id };
}
