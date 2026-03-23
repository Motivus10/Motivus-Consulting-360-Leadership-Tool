# Motivus 360° — Testing & Deployment Guide
## For Dan Oakley & Helen | March 2026

---

## PART 1 — Deploy to Railway (Live Cloud URL)

### What you'll get
Two live URLs — one for the admin dashboard, one for the respondent-facing survey.
All data is stored in a persistent database on Railway's servers.

---

### Step 1 — Create a Railway account

1. Go to **https://railway.app**
2. Click **"Start a New Project"**
3. Sign up with your GitHub account (free — no credit card needed)

---

### Step 2 — Push the code to GitHub

You need the code on GitHub so Railway can deploy it.

1. Go to **https://github.com** and create a free account if you don't have one
2. Create a **new repository** called `motivus360`
3. Make it **Private**
4. On your computer, open Terminal (Mac) or Command Prompt (Windows)
5. Run these commands (replacing `YOUR_USERNAME` with your GitHub username):

```bash
cd motivus360
git init
git add .
git commit -m "Initial Motivus 360 platform"
git remote add origin https://github.com/YOUR_USERNAME/motivus360.git
git push -u origin main
```

---

### Step 3 — Deploy the Server on Railway

1. In Railway, click **"New Project"**
2. Choose **"Deploy from GitHub repo"**
3. Select your `motivus360` repository
4. When asked which folder, choose **`server`**
5. Railway will detect it's a Node.js app automatically
6. Go to **Settings → Variables** and add these:

| Variable | Value |
|----------|-------|
| `PORT` | `4000` |
| `JWT_SECRET` | `motivus-360-helen-dan-2026-secret` |
| `NODE_ENV` | `production` |

7. Leave SMTP blank for now (we'll add it in Part 2)
8. Click **Deploy** — wait ~2 minutes
9. Go to **Settings → Networking → Generate Domain**
10. Copy the URL — it will look like: `https://motivus360-server-production.up.railway.app`
    **Save this — you need it for the next step**

---

### Step 4 — Deploy the Client on Railway

1. In Railway, click **"New Project"** again (or **"+ New Service"** in the same project)
2. Choose **"Deploy from GitHub repo"**
3. Select `motivus360` again, but this time choose the **`client`** folder
4. Go to **Settings → Variables** and add:

| Variable | Value |
|----------|-------|
| `REACT_APP_API_URL` | `https://YOUR-SERVER-URL.up.railway.app` |
| `NODE_ENV` | `production` |

   *(Replace with the server URL you copied in Step 3)*

5. Go to **Settings → Networking → Generate Domain**
6. Copy the client URL — e.g. `https://motivus360-client-production.up.railway.app`
7. **Go back to the Server service** → Settings → Variables → add:

| Variable | Value |
|----------|-------|
| `BASE_URL` | `https://YOUR-CLIENT-URL.up.railway.app` |
| `CLIENT_URL` | `https://YOUR-CLIENT-URL.up.railway.app` |

8. Redeploy the server (click **"Redeploy"**)

---

### Step 5 — First login

1. Open your client URL in a browser
2. You should see the Motivus login page
3. Log in with:
   - **Email:** `admin@motivusconsulting.co.uk`
   - **Password:** `motivus2026`

🎉 **You're live!**

---

## PART 2 — Set Up Real Email Sending

We recommend using **Gmail** for testing — it's free and works immediately.

### Option A: Gmail (easiest for testing)

1. Log into the Gmail account you want to send from (e.g. `helen@motivusconsulting.co.uk` or a test Gmail)
2. Go to: **Google Account → Security → 2-Step Verification** → turn ON
3. Then go to: **Google Account → Security → App Passwords**
4. Create an app password for "Mail" — Google will give you a 16-character password
5. In Railway, add these variables to the **Server** service:

| Variable | Value |
|----------|-------|
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | `your-gmail@gmail.com` |
| `SMTP_PASS` | `your-16-char-app-password` |
| `FROM_EMAIL` | `your-gmail@gmail.com` |

6. Redeploy the server
7. Test by creating a project and sending a nomination invite

---

### Option B: Mailgun (better for production, 100 free emails/day)

1. Sign up at **https://mailgun.com** (free tier)
2. Add and verify your domain (`motivusconsulting.co.uk`)
3. Get your SMTP credentials from the Mailgun dashboard
4. Add to Railway Server variables:

| Variable | Value |
|----------|-------|
| `SMTP_HOST` | `smtp.mailgun.org` |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | `postmaster@mg.motivusconsulting.co.uk` |
| `SMTP_PASS` | `your-mailgun-password` |
| `FROM_EMAIL` | `noreply@motivusconsulting.co.uk` |

---

## PART 3 — Seed Test Data

Once deployed, populate the database with realistic test data so you can explore the full platform immediately.

### On your local machine (before deploying):
```bash
cd server
npm install
node seed_test_data.js
```

### What it creates:
- **1 project:** Daniel Thomas at Apex FMCG Ltd
- **13 raters:** across all 5 groups (Self, Manager, 4 Peers, 4 Team Members, 3 Stakeholders)
- **All 37 questions scored** with realistic, varied responses
- **Constraint/risk answers** reflecting Daniel's realistic profile
- **Open-ended comments** from 8 raters

### Variants:
```bash
node seed_test_data.js              # All 13 raters submitted (complete project)
node seed_test_data.js --partial    # 10 submitted, 3 still in progress/pending
node seed_test_data.js --reset      # Wipe everything and start fresh
```

After running, the script prints all access codes so you can test the survey as any rater.

---

## PART 4 — Structured Test Plan

Work through this checklist with Helen. Tick each item when confirmed working.

---

### 🔐 ADMIN — Authentication
- [ ] Log in with correct credentials → dashboard loads
- [ ] Log in with wrong password → error message shown
- [ ] Session persists after browser refresh
- [ ] Sign out works and redirects to login

---

### 📋 ADMIN — Project Management
- [ ] Create a new project (Dan as subject, Helen as a rater)
- [ ] Project appears in dashboard with correct status badge
- [ ] Completion bar shows 0/0
- [ ] Deadline displays correctly

---

### 📧 EMAIL — Nomination Invite to Subject
- [ ] Click "Send Nomination Invite" on new project
- [ ] Email arrives in Dan's inbox within 2 minutes
- [ ] Email contains correct name, unique link and access code
- [ ] Link in email opens the correct nomination page

---

### 📝 SUBJECT — Nominations Flow
- [ ] Landing page shows Dan's name and correct instructions
- [ ] All 4 group definitions are shown clearly (Manager, Peers, Team Members, Other Stakeholders)
- [ ] Form validates: can't submit without minimum raters per group
- [ ] Can add and remove rows
- [ ] Submit sends email to manager for approval
- [ ] Confirmation page shows submitted nominations correctly

---

### ✅ MANAGER — Approval Flow
- [ ] Approval email arrives in manager's inbox
- [ ] Approval link opens the correct page with all nominations listed
- [ ] Manager can remove a nomination
- [ ] Manager can add an optional note
- [ ] Clicking "Approve & Send" sends invite emails to all raters
- [ ] Confirmation emails sent to subject and admin

---

### 📨 EMAIL — Rater Invitations
- [ ] Each rater receives a personalised email
- [ ] Email contains their unique access code clearly
- [ ] "Start Feedback" button links to correct survey URL
- [ ] Access code in the link pre-fills on the survey page

---

### 📊 RATER — Survey Flow (test as multiple raters)
- [ ] Landing page shows subject name and rater group
- [ ] Rating scale clearly explains all 6 levels
- [ ] Can rate all questions 1–6
- [ ] "Can't say" option works
- [ ] Progress saves automatically (close and reopen — answers preserved)
- [ ] All 11 sections navigate correctly
- [ ] Constraints & Risks Yes/No section works
- [ ] Open-ended comments save correctly
- [ ] Review screen shows completion status per section
- [ ] Submit button works → thank you screen shown
- [ ] Trying to use the code again after submission → "already submitted" message

---

### 📈 ADMIN — Results
- [ ] Completion bar updates as raters submit
- [ ] Scores tab shows correct averages per group per question
- [ ] Range (min–max) shows correctly
- [ ] Constraints & Risks tab shows correct percentages
- [ ] Comments tab shows anonymised comments grouped by rater group
- [ ] Results available before all raters have submitted (partial view)

---

### 🔒 SECURITY & EDGE CASES
- [ ] Invalid access code → clear error message
- [ ] Expired/unknown nomination code → error
- [ ] Admin pages redirect to login if not authenticated
- [ ] Rater cannot see another rater's responses
- [ ] Admin cannot see individual rater scores (only group averages)

---

## PART 5 — Test Accounts to Set Up

Create these in the admin dashboard for your end-to-end test:

| Role | Name | Email | Notes |
|------|------|-------|-------|
| Subject | Dan Oakley | dan@motivusconsulting.co.uk | Will nominate raters |
| Manager/Approver | Helen [surname] | helen@motivusconsulting.co.uk | Will receive approval email |
| Rater — Peer | Dan (second email) | dan+peer@motivusconsulting.co.uk | Use Gmail + alias |
| Rater — Team | Helen (second email) | helen+team@motivusconsulting.co.uk | Use Gmail + alias |

**Tip:** Gmail ignores everything after a `+` sign in the address — so `dan+peer@gmail.com` 
delivers to `dan@gmail.com`. This means you can test multiple rater inboxes with just two email accounts.

---

## PART 6 — Useful Admin Actions

### Change admin password
```bash
cd server
node -e "
const db = require('./db');
const bcrypt = require('bcryptjs');
const hash = bcrypt.hashSync('YOUR_NEW_PASSWORD', 10);
db.prepare('UPDATE admins SET password_hash=? WHERE email=?').run(hash, 'admin@motivusconsulting.co.uk');
console.log('Password updated');
"
```

### Add Helen as an admin
```bash
node -e "
const db = require('./db');
const bcrypt = require('bcryptjs');
const hash = bcrypt.hashSync('helen2026', 10);
db.prepare('INSERT INTO admins (email, password_hash, name) VALUES (?,?,?)').run('helen@motivusconsulting.co.uk', hash, 'Helen');
console.log('Helen added as admin');
"
```

### View all projects in database
```bash
node -e "
const db = require('./db');
console.table(db.prepare('SELECT id, subject_name, status, nomination_code FROM projects').all());
"
```

### Reset a rater so they can retake the survey (testing only)
```bash
node -e "
const db = require('./db');
const code = 'THEIR_CODE';
db.prepare('UPDATE raters SET status=\'pending\', submitted_at=NULL, started_at=NULL WHERE access_code=?').run(code);
db.prepare('DELETE FROM responses WHERE rater_id=(SELECT id FROM raters WHERE access_code=?)').run(code);
db.prepare('DELETE FROM constraint_responses WHERE rater_id=(SELECT id FROM raters WHERE access_code=?)').run(code);
db.prepare('DELETE FROM comments WHERE rater_id=(SELECT id FROM raters WHERE access_code=?)').run(code);
console.log('Rater reset — they can now retake the survey');
"
```

---

## Quick Reference

| URL | Purpose |
|-----|---------|
| `https://your-client.railway.app/admin/login` | Admin login |
| `https://your-client.railway.app/admin` | Admin dashboard |
| `https://your-client.railway.app/survey?code=XXXXXXXX` | Rater survey |
| `https://your-client.railway.app/nominate?code=XXXXXXXX` | Subject nominations |

| Credential | Value |
|-----------|-------|
| Admin email | `admin@motivusconsulting.co.uk` |
| Admin password | `motivus2026` ← change this before client testing! |

---

*Motivus Consulting Ltd | Confidential | March 2026*
