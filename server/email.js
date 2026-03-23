// Email service — logs to console in dev, sends real email when SMTP_HOST is configured
const nodemailer = require('nodemailer');

const useReal = !!(process.env.SMTP_HOST);

const transporter = useReal
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    })
  : null;

const FROM = process.env.FROM_EMAIL || 'noreply@motivusconsulting.co.uk';
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

async function send(to, subject, html) {
  if (useReal) {
    await transporter.sendMail({ from: `Motivus Consulting <${FROM}>`, to, subject, html });
    console.log(`📧 Email sent to ${to}: ${subject}`);
  } else {
    console.log(`\n📧 [EMAIL SIMULATION]`);
    console.log(`   To:      ${to}`);
    console.log(`   Subject: ${subject}`);
    console.log(`   Body:    ${html.replace(/<[^>]+>/g, '').trim().slice(0, 200)}...`);
    console.log('');
  }
}

// Invite a rater to complete feedback
async function sendRaterInvite({ raterName, raterEmail, subjectName, accessCode, groupName }) {
  const url = `${BASE_URL}/survey?code=${accessCode}`;
  const subject = `You have been invited to provide 360° feedback on ${subjectName}`;
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
      <div style="background:#0D51A2;padding:24px;text-align:center">
        <h1 style="color:white;margin:0;font-size:24px">motivus <span style="color:#6EA2D0">CONSULTING</span></h1>
      </div>
      <div style="padding:32px;background:#f9f9f9">
        <h2 style="color:#0D51A2">Leadership 360° Feedback</h2>
        <p>Dear ${raterName || 'Colleague'},</p>
        <p>You have been invited to provide confidential 360° feedback on <strong>${subjectName}</strong> as part of their leadership development programme.</p>
        <p>Your feedback is completely <strong>anonymous</strong>. It will be combined with other responses and only group averages will be reported.</p>
        <p>You are providing feedback as: <strong>${groupName}</strong></p>
        <p>Your unique access code is:</p>
        <div style="background:#0D51A2;color:white;font-size:28px;font-weight:bold;text-align:center;padding:16px;letter-spacing:4px;border-radius:8px;margin:16px 0">
          ${accessCode}
        </div>
        <p style="text-align:center">
          <a href="${url}" style="background:#0D51A2;color:white;padding:14px 32px;text-decoration:none;border-radius:6px;font-size:16px;display:inline-block">
            Start Feedback
          </a>
        </p>
        <p style="color:#666;font-size:13px">Or copy this link: ${url}</p>
        <p style="color:#666;font-size:13px">You can save your progress and return at any time using this code.</p>
      </div>
      <div style="background:#0D51A2;padding:12px;text-align:center">
        <p style="color:#aaccee;font-size:12px;margin:0">© Motivus Consulting Ltd | Confidential</p>
      </div>
    </div>
  `;
  await send(raterEmail, subject, html);
}

// Invite the subject to submit their nominations
async function sendNominationInvite({ subjectName, subjectEmail, nominationCode }) {
  const url = `${BASE_URL}/nominate?code=${nominationCode}`;
  const subject = `Your 360° Feedback — please submit your rater nominations`;
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
      <div style="background:#0D51A2;padding:24px;text-align:center">
        <h1 style="color:white;margin:0;font-size:24px">motivus <span style="color:#6EA2D0">CONSULTING</span></h1>
      </div>
      <div style="padding:32px;background:#f9f9f9">
        <h2 style="color:#0D51A2">Leadership 360° Feedback</h2>
        <p>Dear ${subjectName},</p>
        <p>Your 360° feedback programme has been set up. The next step is for you to nominate the colleagues you would like to receive feedback from.</p>
        <p><strong>You will need to nominate:</strong></p>
        <ul>
          <li>1 × Line Manager</li>
          <li>3–8 × Peers</li>
          <li>3–8 × Team Members</li>
          <li>3–8 × Stakeholders (optional)</li>
        </ul>
        <p>Your unique nomination code is:</p>
        <div style="background:#0D51A2;color:white;font-size:28px;font-weight:bold;text-align:center;padding:16px;letter-spacing:4px;border-radius:8px;margin:16px 0">
          ${nominationCode}
        </div>
        <p style="text-align:center">
          <a href="${url}" style="background:#0D51A2;color:white;padding:14px 32px;text-decoration:none;border-radius:6px;font-size:16px;display:inline-block">
            Submit Nominations
          </a>
        </p>
      </div>
      <div style="background:#0D51A2;padding:12px;text-align:center">
        <p style="color:#aaccee;font-size:12px;margin:0">© Motivus Consulting Ltd | Confidential</p>
      </div>
    </div>
  `;
  await send(subjectEmail, subject, html);
}

// Notify admin that all raters have submitted
async function sendCompletionAlert({ adminEmail, subjectName, projectId }) {
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:32px">
      <h2 style="color:#0D51A2">360° Feedback Complete</h2>
      <p>All raters have submitted their feedback for <strong>${subjectName}</strong>.</p>
      <p>Log in to the admin dashboard to generate the report.</p>
      <p><a href="${BASE_URL}/admin/projects/${projectId}" style="color:#0D51A2">View Project →</a></p>
    </div>
  `;
  await send(adminEmail, `All feedback received — ${subjectName}`, html);
}

module.exports = { sendRaterInvite, sendNominationInvite, sendCompletionAlert };
