require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const jwt        = require('jsonwebtoken');
const bcrypt     = require('bcryptjs');
const db         = require('./db');

const app  = express();
const PORT = process.env.PORT || 4000;
const SECRET = process.env.JWT_SECRET || 'motivus_secret_2026';

app.use(cors());
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => res.json({ ok: true, time: new Date() }));

// Auth middleware
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

// ADMIN AUTH
app.post('/api/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const { rows } = await db.query('SELECT * FROM admins WHERE email = $1', [email]);
    const admin = rows[0];
    if (!admin || !bcrypt.compareSync(password, admin.password_hash))
      return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: admin.id, email: admin.email, name: admin.name }, SECRET, { expiresIn: '8h' });
    res.json({ token, name: admin.name });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PROJECTS
app.get('/api/admin/projects', requireAdmin, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT p.*,
        (SELECT COUNT(*) FROM raters WHERE project_id = p.id) as total_raters,
        (SELECT COUNT(*) FROM raters WHERE project_id = p.id AND status = 'submitted') as submitted_count
      FROM projects p ORDER BY p.created_at DESC
    `);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/admin/projects', requireAdmin, async (req, res) => {
  try {
    const { subject_name, subject_email, company, deadline } = req.body;
    const { rows } = await db.query(
      'INSERT INTO projects (subject_name, subject_email, company, deadline, created_by) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [subject_name, subject_email, company, deadline, req.admin.id]
    );
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/admin/projects/:id', requireAdmin, async (req, res) => {
  try {
    const { rows: proj } = await db.query('SELECT * FROM projects WHERE id = $1', [req.params.id]);
    if (!proj[0]) return res.status(404).json({ error: 'Not found' });
    const { rows: raters } = await db.query('SELECT * FROM raters WHERE project_id = $1 ORDER BY group_type, id', [req.params.id]);
    const { rows: noms } = await db.query('SELECT * FROM nominations WHERE project_id = $1', [req.params.id]);
    res.json({ ...proj[0], raters, nominations: noms });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/admin/projects/:id/raters/:rid', requireAdmin, async (req, res) => {
  try {
    await db.query('DELETE FROM raters WHERE id = $1', [req.params.rid]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// RATERS
app.post('/api/admin/projects/:id/raters', requireAdmin, async (req, res) => {
  try {
    const { name, email, group_type } = req.body;
    const access_code = Math.random().toString(36).substring(2, 10).toUpperCase();
    const { rows } = await db.query(
      'INSERT INTO raters (project_id, name, email, group_type, access_code) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [req.params.id, name, email, group_type, access_code]
    );
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/admin/projects/:id/send-invites', requireAdmin, async (req, res) => {
  try {
    await db.query(
      "UPDATE raters SET invited_at = CURRENT_TIMESTAMP WHERE project_id = $1 AND status = 'pending'",
      [req.params.id]
    );
    await db.query("UPDATE projects SET status = 'in_progress' WHERE id = $1", [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// RESULTS
app.get('/api/admin/projects/:id/results', requireAdmin, async (req, res) => {
  try {
    const { rows: raters } = await db.query(
      "SELECT * FROM raters WHERE project_id = $1 AND status = 'submitted'", [req.params.id]
    );
    const raterIds = raters.map(r => r.id);
    if (!raterIds.length) return res.json({ scores: [], constraints: [], comments: [] });

    const { rows: scores } = await db.query(
      'SELECT r.group_type, resp.section, resp.question_index, resp.score FROM responses resp JOIN raters r ON r.id = resp.rater_id WHERE resp.rater_id = ANY($1)',
      [raterIds]
    );
    const { rows: constraints } = await db.query(
      'SELECT r.group_type, cr.section, cr.constraint_index, cr.answer FROM constraints_responses cr JOIN raters r ON r.id = cr.rater_id WHERE cr.rater_id = ANY($1)',
      [raterIds]
    );
    const { rows: comments } = await db.query(
      'SELECT r.group_type, c.section, c.strengths, c.improvements FROM comments c JOIN raters r ON r.id = c.rater_id WHERE c.rater_id = ANY($1)',
      [raterIds]
    );
    res.json({ scores, constraints, comments });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// SURVEY (rater-facing)
app.post('/api/survey/start', async (req, res) => {
  try {
    const { access_code } = req.body;
    const { rows } = await db.query(
      'SELECT r.*, p.subject_name FROM raters r JOIN projects p ON p.id = r.project_id WHERE r.access_code = $1',
      [access_code.toUpperCase()]
    );
    const rater = rows[0];
    if (!rater) return res.status(404).json({ error: 'Invalid code' });
    if (rater.status === 'submitted') return res.status(400).json({ error: 'Already submitted' });
    await db.query("UPDATE raters SET status = 'in_progress', started_at = CURRENT_TIMESTAMP WHERE id = $1", [rater.id]);
    res.json({ rater_id: rater.id, subject_name: rater.subject_name, group_type: rater.group_type });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/survey/progress/:rater_id', async (req, res) => {
  try {
    const { rows: scores } = await db.query('SELECT * FROM responses WHERE rater_id = $1', [req.params.rater_id]);
    const { rows: constraints } = await db.query('SELECT * FROM constraints_responses WHERE rater_id = $1', [req.params.rater_id]);
    const { rows: comments } = await db.query('SELECT * FROM comments WHERE rater_id = $1', [req.params.rater_id]);
    res.json({ scores, constraints, comments });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/survey/save-scores', async (req, res) => {
  try {
    const { rater_id, section, scores } = req.body;
    for (const s of scores) {
      await db.query(
        'INSERT INTO responses (rater_id, section, question_index, score) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING',
        [rater_id, section, s.question_index, s.score]
      );
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/survey/save-constraints', async (req, res) => {
  try {
    const { rater_id, section, constraints } = req.body;
    for (const c of constraints) {
      await db.query(
        'INSERT INTO constraints_responses (rater_id, section, constraint_index, answer) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING',
        [rater_id, section, c.constraint_index, c.answer]
      );
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/survey/save-comments', async (req, res) => {
  try {
    const { rater_id, section, strengths, improvements } = req.body;
    await db.query(
      'INSERT INTO comments (rater_id, section, strengths, improvements) VALUES ($1,$2,$3,$4)',
      [rater_id, section, strengths, improvements]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/survey/submit', async (req, res) => {
  try {
    const { rater_id } = req.body;
    await db.query("UPDATE raters SET status = 'submitted', submitted_at = CURRENT_TIMESTAMP WHERE id = $1", [rater_id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// NOMINATIONS
app.get('/api/nominations/:code', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM projects WHERE id = $1', [req.params.code]);
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/nominations/:project_id', async (req, res) => {
  try {
    const { nominations } = req.body;
    for (const n of nominations) {
      await db.query(
        'INSERT INTO nominations (project_id, name, email, group_type) VALUES ($1,$2,$3,$4)',
        [req.params.project_id, n.name, n.email, n.group_type]
      );
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.listen(PORT, "0.0.0.0", () => console.log(`✓ Motivus 360 server running on port ${PORT}`));
