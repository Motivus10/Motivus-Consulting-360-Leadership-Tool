# Motivus 360° Feedback Platform

A full-stack web platform for managing Leadership 360° feedback surveys.

## Architecture

```
motivus360/
  server/   — Node.js + Express + SQLite backend (API)
  client/   — React frontend (Admin dashboard + Respondent survey)
```

## Quick Start (Local Development)

### 1. Install dependencies

```bash
# Server
cd server && npm install

# Client
cd ../client && npm install
```

### 2. Configure environment

```bash
cd server
cp .env.example .env
# Edit .env — set JWT_SECRET at minimum
```

### 3. Start the server

```bash
cd server && node index.js
# Runs on http://localhost:4000
# Database is created automatically on first run
```

### 4. Start the client

```bash
cd client && npm start
# Opens http://localhost:3000
```

### 5. Log in

- URL: http://localhost:3000/admin/login
- Email: admin@motivusconsulting.co.uk
- Password: motivus2026

---

## Deploying to Railway (Cloud)

1. Create a new project on [railway.app](https://railway.app)
2. Add two services: one for `server/`, one for `client/`
3. Set environment variables in Railway dashboard
4. Set `BASE_URL` to your deployed client URL
5. Set `REACT_APP_API_URL` to your deployed server URL

---

## How It Works

### Admin Flow
1. Log in to `/admin`
2. Create a new 360° Project (subject name, email, company, deadline)
3. Either:
   - **Send nomination invite** to the subject (they pick their own raters), or
   - **Add raters manually** (email + group assignment)
4. Click **Send Rater Invites** — each rater receives a unique access code by email
5. Monitor progress on the project page
6. View results at any time; generate report when ready

### Subject Nomination Flow
1. Subject receives email with unique nomination link
2. They visit `/nominate?code=XXXXXXXX`
3. They enter emails for: Manager (1), Peers (3–8), Team Members (3–8), Stakeholders (0–8)
4. Admin reviews nominations and approves/adds them to the project

### Rater Survey Flow
1. Rater receives email with unique access code
2. They visit `/survey?code=XXXXXXXX`
3. They complete:
   - **Ratings** (1–6) for each of 36 statements, section by section
   - **Constraints & Risks** (Yes/No) for each section
   - **Open-ended comments** (two text boxes)
4. Progress is auto-saved — they can return at any time
5. On final submission, if all raters are done, admin is notified

### Results
- Scores: average per rater group per question, with range (min–max)
- Constraints/Risks: % of raters who answered Yes, per group
- Comments: displayed anonymously by group

---

## Email Configuration

In development, emails are printed to the console (no SMTP needed).

For production, set these environment variables:
```
SMTP_HOST=smtp.yourprovider.com
SMTP_PORT=587
SMTP_USER=noreply@motivusconsulting.co.uk
SMTP_PASS=your-password
FROM_EMAIL=noreply@motivusconsulting.co.uk
```

Compatible with: Gmail (App Password), SendGrid, Mailgun, Amazon SES, etc.

---

## Default Admin Credentials

Email: `admin@motivusconsulting.co.uk`  
Password: `motivus2026`

**Change these immediately in production.**

---

## Tech Stack

- **Backend:** Node.js, Express, better-sqlite3, jsonwebtoken, bcryptjs, nodemailer
- **Frontend:** React 18, React Router v6
- **Database:** SQLite (single file, zero config)
- **Styling:** Custom CSS with Motivus brand colours
