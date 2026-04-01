const BASE_URL = process.env.FRONTEND_URL || 'https://motivus360.netlify.app';
const FROM = 'Motivus Consulting <onboarding@resend.dev>';

async function send(to, subject, html) {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to, subject, html })
  });
  if (!r.ok) { const e = await r.text(); throw new Error('Resend error: ' + e); }
}

async function sendRaterInvite({ raterName, raterEmail, subjectName, surveyUrl, deadline }) {
  const html = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:32px">
    <h2 style="color:#0D51A2">360° Feedback Request</h2>
    <p>Dear ${raterName},</p>
    <p>You have been asked to provide 360 feedback for <strong>${subjectName}</strong>.</p>
    <p>Please click the link below to complete your feedback by ${deadline}:</p>
    <p><a href="${surveyUrl}" style="background:#1a3a6b;color:white;padding:12px 24px;text-decoration:none;border-radius:4px;display:inline-block">Complete Feedback</a></p>
    <p>If the button does not work, copy this link: ${surveyUrl}</p>
    <p>Thank you,<br>Motivus Consulting</p>
  </div>`;
  await send(raterEmail, '360 Feedback Request for ' + subjectName, html);
}

async function sendNominationInvite({ name, email, code, subjectName }) {
  const nominateUrl = BASE_URL + '/nominate/' + code;
  const html = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:32px">
    <h2 style="color:#0D51A2">360° Nomination Request</h2>
    <p>Dear ${name},</p>
    <p>You have been asked to nominate raters for <strong>${subjectName}</strong>'s 360 feedback.</p>
    <p><a href="${nominateUrl}" style="background:#1a3a6b;color:white;padding:12px 24px;text-decoration:none;border-radius:4px;display:inline-block">Submit Nominations</a></p>
  </div>`;
  await send(email, 'Submit Nominations - ' + subjectName, html);
}

async function sendCompletionAlert({ adminEmail, subjectName, projectId }) {
  const html = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:32px">
    <h2 style="color:#0D51A2">360° Feedback Complete</h2>
    <p>All raters have submitted their feedback for <strong>${subjectName}</strong>.</p>
    <p><a href="${BASE_URL}/admin/projects/${projectId}" style="color:#0D51A2">View Project</a></p>
  </div>`;
  await send(adminEmail, 'All feedback received - ' + subjectName, html);
}

module.exports = { sendRaterInvite, sendNominationInvite, sendCompletionAlert };
