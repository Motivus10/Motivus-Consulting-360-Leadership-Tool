require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const jwt        = require('jsonwebtoken');
const bcrypt     = require('bcryptjs');
const { v4: uuid } = require('uuid');
const db         = require('./db');
const email      = require('./email');

const app    = express();
const SECRET = process.env.JWT_SECRET || 'motivus-360-secret-change-in-prod';
const PORT   = process.env.PORT || 4000;

app.use(cors({
  origin: process.env.CLIENT_URL ? [process.env.CLIENT_URL, 'http://localhost:3000'] : '*',
  credentials: true,
}));
app.use(express.json());

// ── Auth middleware ──────────────────────────────────────────────────────────
function requireAdmin(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Unauthorised' });
  try {
    req.admin = jwt.verify(token, SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// ── ADMIN AUTH ───────────────────────────────────────────────────────────────
app.post('/api/admin/login', (req, res) => {
  const { email: em, password } = req.body;
  const admin = db.prepare('SELECT * FROM admins WHERE email = ?').get(em);
  if (!admin || !bcrypt.compareSync(password, admin.password_hash))
    return res.status(401).json({ error: 'Invalid credentials' });
  const token = jwt.sign({ id: admin.id, email: admin.email, name: admin.name }, SECRET, { expiresIn: '8h' });
  res.json({ token, name: admin.name });
});

// ── PROJECTS ─────────────────────────────────────────────────────────────────
app.get('/api/admin/projects', requireAdmin, (req, res) => {
  const projects = db.prepare(`
    SELECT p.*,
      (SELECT COUNT(*) FROM raters WHERE project_id = p.id) as total_raters,
      (SELECT COUNT(*) FROM raters WHERE project_id = p.id AND status = 'submitted') as submitted_count
    FROM projects p ORDER BY p.created_at DESC
  `).all();
  res.json(projects);
});

app.post('/api/admin/projects', requireAdmin, async (req, res) => {
  const { subject_name, subject_email, company, deadline } = req.body;
  if (!subject_name || !subject_email) return res.status(400).json({ error: 'Name and email required' });

  const nomination_code = uuid().replace(/-/g,'').slice(0,8).toUpperCase();

  const result = db.prepare(`
    INSERT INTO projects (subject_name, subject_email, company, deadline, created_by, nomination_code, status)
    VALUES (?, ?, ?, ?, ?, ?, 'setup')
  `).run(subject_name, subject_email, company || null, deadline || null, req.admin.id, nomination_code);

  const projectId = result.lastInsertRowid;

  // Create the 5 standard rater groups
  const groups = ['Self', 'Manager', 'Peers', 'Team Members', 'Stakeholders'];
  const insertGroup = db.prepare('INSERT INTO rater_groups (project_id, name) VALUES (?, ?)');
  groups.forEach(g => insertGroup.run(projectId, g));

  res.json({ id: projectId, nomination_code });
});

app.get('/api/admin/projects/:id', requireAdmin, (req, res) => {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Not found' });

  const groups = db.prepare('SELECT * FROM rater_groups WHERE project_id = ?').all(project.id);
  const raters = db.prepare('SELECT r.*, rg.name as group_name FROM raters r JOIN rater_groups rg ON r.group_id = rg.id WHERE r.project_id = ?').all(project.id);
  const nominations = db.prepare('SELECT * FROM nominations WHERE project_id = ?').all(project.id);

  res.json({ ...project, groups, raters, nominations });
});

app.patch('/api/admin/projects/:id/status', requireAdmin, (req, res) => {
  const { status } = req.body;
  db.prepare('UPDATE projects SET status = ? WHERE id = ?').run(status, req.params.id);
  res.json({ ok: true });
});

// Send nomination invite to subject
app.post('/api/admin/projects/:id/send-nomination-invite', requireAdmin, async (req, res) => {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Not found' });

  await email.sendNominationInvite({
    subjectName: project.subject_name,
    subjectEmail: project.subject_email,
    nominationCode: project.nomination_code,
  });

  db.prepare("UPDATE projects SET status = 'nominations_open' WHERE id = ?").run(project.id);
  res.json({ ok: true });
});

// ── RATERS ───────────────────────────────────────────────────────────────────
app.post('/api/admin/projects/:id/raters', requireAdmin, (req, res) => {
  const { email: raterEmail, name, group_id } = req.body;
  const accessCode = uuid().replace(/-/g,'').slice(0,8).toUpperCase();
  const result = db.prepare(`
    INSERT INTO raters (project_id, group_id, email, name, access_code)
    VALUES (?, ?, ?, ?, ?)
  `).run(req.params.id, group_id, raterEmail, name || null, accessCode);
  res.json({ id: result.lastInsertRowid, access_code: accessCode });
});

app.delete('/api/admin/raters/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM raters WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Send invites to all raters who haven't been invited yet
app.post('/api/admin/projects/:id/send-invites', requireAdmin, async (req, res) => {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  const raters  = db.prepare(`
    SELECT r.*, rg.name as group_name FROM raters r
    JOIN rater_groups rg ON r.group_id = rg.id
    WHERE r.project_id = ? AND r.invite_sent = 0
  `).all(req.params.id);

  let sent = 0;
  for (const rater of raters) {
    await email.sendRaterInvite({
      raterName:   rater.name,
      raterEmail:  rater.email,
      subjectName: project.subject_name,
      accessCode:  rater.access_code,
      groupName:   rater.group_name,
    });
    db.prepare("UPDATE raters SET invite_sent=1, invite_sent_at=CURRENT_TIMESTAMP WHERE id=?").run(rater.id);
    sent++;
  }

  db.prepare("UPDATE projects SET status='in_progress' WHERE id=?").run(req.params.id);
  res.json({ sent });
});

// ── RESULTS for admin ─────────────────────────────────────────────────────────
app.get('/api/admin/projects/:id/results', requireAdmin, (req, res) => {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Not found' });

  // Avg scores per question per group
  const scores = db.prepare(`
    SELECT q.id as question_id, q.section, q.section_title, q.question_number, q.question_text,
           rg.name as group_name,
           ROUND(AVG(CASE WHEN r2.cannot_say=0 THEN r2.score END), 1) as avg_score,
           MIN(CASE WHEN r2.cannot_say=0 THEN r2.score END) as min_score,
           MAX(CASE WHEN r2.cannot_say=0 THEN r2.score END) as max_score,
           COUNT(CASE WHEN r2.cannot_say=1 THEN 1 END) as cannot_say_count,
           COUNT(CASE WHEN r2.cannot_say=0 THEN 1 END) as rated_count
    FROM questions q
    CROSS JOIN rater_groups rg
    LEFT JOIN raters ra ON ra.project_id = ? AND ra.group_id = rg.id AND ra.status='submitted'
    LEFT JOIN responses r2 ON r2.question_id = q.id AND r2.rater_id = ra.id
    WHERE rg.project_id = ? AND q.active=1
    GROUP BY q.id, rg.id
    ORDER BY q.section, q.question_number, rg.name
  `).all(project.id, project.id);

  // Constraint/risk percentages per group
  const constraints = db.prepare(`
    SELECT ci.id, ci.section, ci.item_type, ci.item_text,
           rg.name as group_name,
           COUNT(cr.id) as yes_count,
           (SELECT COUNT(*) FROM raters WHERE project_id=? AND group_id=rg.id AND status='submitted') as total
    FROM constraint_items ci
    CROSS JOIN rater_groups rg
    LEFT JOIN raters ra ON ra.project_id=? AND ra.group_id=rg.id AND ra.status='submitted'
    LEFT JOIN constraint_responses cr ON cr.constraint_item_id=ci.id AND cr.rater_id=ra.id AND cr.answer=1
    WHERE rg.project_id=?
    GROUP BY ci.id, rg.id
    ORDER BY ci.section, ci.item_type, ci.display_order
  `).all(project.id, project.id, project.id);

  // Comments (anonymised — no rater id in output)
  const comments = db.prepare(`
    SELECT c.comment_type, c.comment_text, rg.name as group_name
    FROM comments c
    JOIN raters ra ON ra.id = c.rater_id
    JOIN rater_groups rg ON rg.id = ra.group_id
    WHERE c.project_id = ?
    ORDER BY c.comment_type, rg.name
  `).all(project.id);

  // Completion status
  const completion = db.prepare(`
    SELECT rg.name as group_name,
           COUNT(ra.id) as total,
           COUNT(CASE WHEN ra.status='submitted' THEN 1 END) as submitted
    FROM rater_groups rg
    LEFT JOIN raters ra ON ra.group_id = rg.id AND ra.project_id = rg.project_id
    WHERE rg.project_id = ?
    GROUP BY rg.id
  `).all(project.id);

  res.json({ project, scores, constraints, comments, completion });
});

// ── NOMINATIONS (subject flow) ────────────────────────────────────────────────
app.get('/api/nominate/:code', (req, res) => {
  const project = db.prepare('SELECT id, subject_name, nomination_submitted FROM projects WHERE nomination_code = ?').get(req.params.code);
  if (!project) return res.status(404).json({ error: 'Invalid code' });
  res.json(project);
});

app.post('/api/nominate/:code', async (req, res) => {
  const project = db.prepare('SELECT * FROM projects WHERE nomination_code = ?').get(req.params.code);
  if (!project) return res.status(404).json({ error: 'Invalid code' });
  if (project.nomination_submitted) return res.status(400).json({ error: 'Already submitted' });

  const { nominations } = req.body; // [{ group_name, email, name }]
  if (!nominations?.length) return res.status(400).json({ error: 'No nominations provided' });

  const insertNom = db.prepare('INSERT INTO nominations (project_id, group_name, email, name) VALUES (?, ?, ?, ?)');
  const insertTx  = db.transaction((noms) => {
    for (const n of noms) insertNom.run(project.id, n.group_name, n.email, n.name || null);
  });
  insertTx(nominations);

  db.prepare('UPDATE projects SET nomination_submitted=1 WHERE id=?').run(project.id);
  res.json({ ok: true, count: nominations.length });
});

// ── SURVEY (rater flow) ───────────────────────────────────────────────────────
app.get('/api/survey/auth', (req, res) => {
  const { code } = req.query;
  const rater = db.prepare(`
    SELECT r.*, rg.name as group_name, p.subject_name, p.status as project_status
    FROM raters r
    JOIN rater_groups rg ON rg.id = r.group_id
    JOIN projects p ON p.id = r.project_id
    WHERE r.access_code = ?
  `).get(code);

  if (!rater) return res.status(404).json({ error: 'Invalid access code' });
  if (rater.status === 'submitted') return res.json({ submitted: true, subject_name: rater.subject_name });

  // Mark as started if first time
  if (!rater.started_at) {
    db.prepare("UPDATE raters SET started_at=CURRENT_TIMESTAMP, status='in_progress' WHERE id=?").run(rater.id);
  }

  // Load questions
  const questions = db.prepare('SELECT * FROM questions WHERE active=1 ORDER BY section, question_number').all();
  // Load constraint items
  const constraintItems = db.prepare('SELECT * FROM constraint_items ORDER BY section, item_type, display_order').all();
  // Load existing saved responses
  const savedScores = db.prepare('SELECT question_id, score, cannot_say FROM responses WHERE rater_id=?').all(rater.id);
  const savedConstraints = db.prepare('SELECT constraint_item_id, answer FROM constraint_responses WHERE rater_id=?').all(rater.id);
  const savedComments = db.prepare('SELECT comment_type, comment_text FROM comments WHERE rater_id=?').all(rater.id);

  res.json({
    rater_id: rater.id,
    group_name: rater.group_name,
    subject_name: rater.subject_name,
    questions,
    constraintItems,
    savedScores,
    savedConstraints,
    savedComments,
  });
});

// Save progress (called on each section completion)
app.post('/api/survey/save', async (req, res) => {
  const { code, scores, constraintAnswers, comments } = req.body;
  const rater = db.prepare('SELECT * FROM raters WHERE access_code = ?').get(code);
  if (!rater) return res.status(404).json({ error: 'Invalid code' });
  if (rater.status === 'submitted') return res.status(400).json({ error: 'Already submitted' });

  const saveAll = db.transaction(() => {
    // Upsert scores
    if (scores?.length) {
      const upsertScore = db.prepare(`
        INSERT INTO responses (rater_id, project_id, question_id, score, cannot_say)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(rater_id, question_id) DO UPDATE SET score=excluded.score, cannot_say=excluded.cannot_say, saved_at=CURRENT_TIMESTAMP
      `);
      // Add unique constraint if not exists (handled via replace)
      for (const s of scores) {
        db.prepare('DELETE FROM responses WHERE rater_id=? AND question_id=?').run(rater.id, s.question_id);
        upsertScore.run(rater.id, rater.project_id, s.question_id, s.score || null, s.cannot_say ? 1 : 0);
      }
    }

    // Upsert constraint answers
    if (constraintAnswers?.length) {
      for (const ca of constraintAnswers) {
        db.prepare('DELETE FROM constraint_responses WHERE rater_id=? AND constraint_item_id=?').run(rater.id, ca.constraint_item_id);
        db.prepare('INSERT INTO constraint_responses (rater_id, project_id, constraint_item_id, answer) VALUES (?,?,?,?)')
          .run(rater.id, rater.project_id, ca.constraint_item_id, ca.answer ? 1 : 0);
      }
    }

    // Upsert comments
    if (comments?.length) {
      for (const c of comments) {
        db.prepare('DELETE FROM comments WHERE rater_id=? AND comment_type=?').run(rater.id, c.type);
        if (c.text?.trim()) {
          db.prepare('INSERT INTO comments (rater_id, project_id, comment_type, comment_text) VALUES (?,?,?,?)')
            .run(rater.id, rater.project_id, c.type, c.text.trim());
        }
      }
    }
  });
  saveAll();
  res.json({ ok: true });
});

// Submit (final)
app.post('/api/survey/submit', async (req, res) => {
  const { code } = req.body;
  const rater = db.prepare(`
    SELECT r.*, p.subject_name FROM raters r JOIN projects p ON p.id=r.project_id WHERE r.access_code=?
  `).get(code);
  if (!rater) return res.status(404).json({ error: 'Invalid code' });
  if (rater.status === 'submitted') return res.json({ ok: true });

  db.prepare("UPDATE raters SET status='submitted', submitted_at=CURRENT_TIMESTAMP WHERE id=?").run(rater.id);

  // Check if all raters have now submitted
  const { total, done } = db.prepare(`
    SELECT COUNT(*) as total, COUNT(CASE WHEN status='submitted' THEN 1 END) as done
    FROM raters WHERE project_id=?
  `).get(rater.project_id);

  if (total > 0 && total === done) {
    db.prepare("UPDATE projects SET status='complete' WHERE id=?").run(rater.project_id);
    // Notify admin
    const admin = db.prepare('SELECT a.email FROM projects p JOIN admins a ON a.id=p.created_by WHERE p.id=?').get(rater.project_id);
    if (admin) {
      await email.sendCompletionAlert({ adminEmail: admin.email, subjectName: rater.subject_name, projectId: rater.project_id });
    }
  }

  res.json({ ok: true });
});

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

app.listen(PORT, () => console.log(`✓ Motivus 360 server running on port ${PORT}`));
