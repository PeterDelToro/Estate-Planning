// Del Toro Law — estate intake mailer (Netlify Function)
const RESEND_URL = "https://api.resend.com/emails";
const MAX_BODY_BYTES = 8 * 1024 * 1024;

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return respond(204, {});
  if (event.httpMethod !== "POST") return respond(405, { error: "Method not allowed." });

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const TO_EMAIL = process.env.TO_EMAIL;
  const FROM_EMAIL = process.env.FROM_EMAIL || "Del Toro Law Intake <onboarding@resend.dev>";

  if (!RESEND_API_KEY) return respond(500, { error: "Server not configured: RESEND_API_KEY is missing." });
  if (!TO_EMAIL) return respond(500, { error: "Server not configured: TO_EMAIL is missing." });

  if (event.body && Buffer.byteLength(event.body, "utf8") > MAX_BODY_BYTES) {
    return respond(413, { error: "Submission too large." });
  }

  let data;
  try { data = JSON.parse(event.body || "{}"); }
  catch { return respond(400, { error: "Could not read the submission." }); }

  const name = (data.name || "").toString().slice(0, 200);
  const email = (data.email || "").toString().slice(0, 200);
  const summary = (data.summary || "New estate planning intake submission.").toString();
  const subject = (data.subject || ("New estate planning intake — " + (name || "Unnamed"))).toString().slice(0, 200);

  if (!/.+@.+\..+/.test(email)) return respond(400, { error: "A valid email is required." });

  const attachments = Array.isArray(data.files)
    ? data.files
        .filter((f) => f && f.filename && f.content)
        .slice(0, 5)
        .map((f) => ({ filename: String(f.filename).slice(0, 150), content: String(f.content) }))
    : [];

  const emailPayload = {
    from: FROM_EMAIL,
    to: [TO_EMAIL],
    reply_to: email,
    subject,
    text: summary,
    attachments,
  };

  try {
    const res = await fetch(RESEND_URL, {
      method: "POST",
      headers: { Authorization: "Bearer " + RESEND_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify(emailPayload),
    });
    if (!res.ok) {
      const detail = (await res.text()).slice(0, 500);
      return respond(502, { error: "The email service rejected the message.", detail });
    }
    return respond(200, { ok: true });
  } catch (e) {
    return respond(500, { error: "Could not reach the email service.", detail: String(e).slice(0, 300) });
  }
};

function respond(statusCode, obj) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
    body: JSON.stringify(obj),
  };
}
