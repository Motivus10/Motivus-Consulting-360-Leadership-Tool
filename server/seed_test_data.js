#!/usr/bin/env node
/**
 * Motivus 360 — Test Data Seeder
 * ================================
 * Populates the database with a complete test project including:
 *  - A subject (Daniel Thomas)
 *  - Raters across all 5 groups
 *  - Realistic scores for all 37 questions
 *  - Constraint/risk Yes/No answers
 *  - Open-ended comments
 *
 * Usage:
 *   node seed_test_data.js           — creates test project, leaves existing data
 *   node seed_test_data.js --reset   — wipes all data first, then seeds
 *   node seed_test_data.js --partial — seeds but only marks some raters submitted (for testing in-progress state)
 *
 * After running, log in to the admin dashboard and open the "Daniel Thomas TEST" project.
 */

const db = require('./db');
const { v4: uuid } = require('uuid');
const bcrypt = require('bcryptjs');

const args = process.argv.slice(2);
const RESET   = args.includes('--reset');
const PARTIAL = args.includes('--partial');

console.log('\n🌱 Motivus 360 — Test Data Seeder');
console.log('═══════════════════════════════════');

// ── Optional reset ─────────────────────────────────────────────────────────
if (RESET) {
  console.log('⚠️  Resetting all data...');
  db.exec(`
    DELETE FROM comments;
    DELETE FROM constraint_responses;
    DELETE FROM responses;
    DELETE FROM nominations;
    DELETE FROM raters;
    DELETE FROM rater_groups;
    DELETE FROM projects;
    DELETE FROM admins;
  `);

  // Re-seed admin
  const hash = bcrypt.hashSync('motivus2026', 10);
  db.prepare(`INSERT OR IGNORE INTO admins (email, password_hash, name) VALUES (?, ?, ?)`)
    .run('admin@motivusconsulting.co.uk', hash, 'Motivus Admin');
  console.log('✓ Database reset and admin re-created\n');
}

// ── Get admin ──────────────────────────────────────────────────────────────
const admin = db.prepare('SELECT id FROM admins LIMIT 1').get();
if (!admin) {
  console.error('❌ No admin found. Run the server once first to seed the admin account.');
  process.exit(1);
}

// ── Create test project ────────────────────────────────────────────────────
const nomCode = uuid().replace(/-/g,'').slice(0,8).toUpperCase();
const projectResult = db.prepare(`
  INSERT INTO projects (subject_name, subject_email, company, status, created_by, nomination_code, nomination_submitted, deadline)
  VALUES (?, ?, ?, ?, ?, ?, 1, ?)
`).run('Daniel Thomas', 'daniel.thomas@apexfmcg.com', 'Apex FMCG Ltd', 'in_progress', admin.id, nomCode,
  new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
);
const projectId = projectResult.lastInsertRowid;
console.log(`✓ Created project: Daniel Thomas (ID: ${projectId})`);

// ── Create rater groups ────────────────────────────────────────────────────
const groupNames = ['Self', 'Manager', 'Peers', 'Team Members', 'Stakeholders'];
const groups = {};
const insertGroup = db.prepare('INSERT INTO rater_groups (project_id, name) VALUES (?, ?)');
groupNames.forEach(name => {
  const r = insertGroup.run(projectId, name);
  groups[name] = r.lastInsertRowid;
});
console.log('✓ Created 5 rater groups');

// ── Define test raters ────────────────────────────────────────────────────
const RATERS = [
  { group: 'Self',         name: 'Daniel Thomas',   email: 'daniel.thomas@apexfmcg.com',  bias:  0.0 },
  { group: 'Manager',      name: 'Sarah Mitchell',  email: 's.mitchell@apexfmcg.com',     bias: -0.3 },
  { group: 'Peers',        name: 'James Okafor',    email: 'j.okafor@apexfmcg.com',       bias:  0.2 },
  { group: 'Peers',        name: 'Claire Hutchins', email: 'c.hutchins@apexfmcg.com',     bias: -0.1 },
  { group: 'Peers',        name: 'Tom Reeves',      email: 't.reeves@apexfmcg.com',       bias:  0.3 },
  { group: 'Peers',        name: 'Emma Blackwell',  email: 'e.blackwell@apexfmcg.com',    bias: -0.4 },
  { group: 'Team Members', name: 'Priya Sharma',    email: 'p.sharma@apexfmcg.com',       bias:  0.4 },
  { group: 'Team Members', name: 'Ben Wallis',      email: 'b.wallis@apexfmcg.com',       bias:  0.2 },
  { group: 'Team Members', name: 'Aisha Obi',       email: 'a.obi@apexfmcg.com',          bias:  0.5 },
  { group: 'Team Members', name: 'Mark Delaney',    email: 'm.delaney@apexfmcg.com',      bias: -0.2 },
  { group: 'Stakeholders', name: 'Fiona Grant',     email: 'f.grant@retailpartner.com',   bias:  0.1 },
  { group: 'Stakeholders', name: 'David Chen',      email: 'd.chen@supplierco.com',        bias: -0.1 },
  { group: 'Stakeholders', name: 'Rachel Moore',    email: 'r.moore@apexfmcg.com',        bias:  0.3 },
];

// ── Base scores for each question (what a "typical" rater would give) ──────
// These reflect Daniel's realistic profile: strong strategist, great with people,
// weaker on execution discipline and cross-team conflict
const BASE_SCORES = {
  // Strategy & Long Term
  1: 4.8, 2: 5.0, 3: 4.2,
  // Decision Making
  4: 4.8, 6: 5.0,
  // Action Plans
  7: 3.5, 8: 4.5, 9: 3.8,
  // Making Things Happen
  10: 3.2, 11: 4.5, 12: 3.5,
  // Creating a Winning Team
  13: 5.2, 14: 4.5, 15: 4.0,
  // Communicating with Impact
  16: 4.5, 17: 3.2, 18: 2.8,
  // Integrity and Respect
  27: 5.5, 28: 4.5, 29: 3.2, 30: 5.8,
  // Resilience
  31: 4.0, 32: 3.0, 33: 3.5, 34: 5.2,
  // Impact
  35: 5.0, 36: 4.8, 37: 5.0, 38: 4.8,
  // Emotional Intellect
  39: 4.5, 40: 4.2, 41: 4.2, 42: 4.8,
  // Credibility
  19: 5.0, 20: 4.0, 21: 5.2, 22: 4.5,
};

// Base constraint/risk flags (true = this rater would typically say Yes)
const BASE_CONSTRAINTS = {
  // section: { item_text_fragment: probability_of_yes }
  'Introducing ideas but losing interest': 0.7,
  'Generating ambitious plans that neglect': 0.4,
  'Allowing projects to drift': 0.6,
  'Letting discussions go in circles': 0.35,
  'Focusing only on my own area': 0.65,
  'Allowing a "them and us"': 0.7,
  'Avoiding issues that might create': 0.4,
  'Getting distracted by peripheral': 0.35,
  'Spreading effort too thinly': 0.45,
  'Changing the message': 0.25,
};

function clamp(val, min, max) { return Math.min(max, Math.max(min, val)); }
function round(val) { return Math.round(val); }

// Deterministic "random" based on rater + question — consistent across runs
function deterministicVariance(raterIdx, questionId) {
  const seed = (raterIdx * 37 + questionId * 13) % 100;
  return (seed - 50) / 100; // -0.5 to +0.5
}

// ── Insert raters and their responses ─────────────────────────────────────
const questions = db.prepare('SELECT * FROM questions WHERE active=1').all();
const constraintItems = db.prepare('SELECT * FROM constraint_items').all();
const insertRater    = db.prepare(`INSERT INTO raters (project_id, group_id, email, name, access_code, invite_sent, invite_sent_at, status, started_at, submitted_at) VALUES (?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, ?, CURRENT_TIMESTAMP, ?)`);
const insertResponse = db.prepare(`INSERT INTO responses (rater_id, project_id, question_id, score, cannot_say) VALUES (?, ?, ?, ?, 0)`);
const insertCon      = db.prepare(`INSERT INTO constraint_responses (rater_id, project_id, constraint_item_id, answer) VALUES (?, ?, ?, ?)`);
const insertComment  = db.prepare(`INSERT INTO comments (rater_id, project_id, comment_type, comment_text) VALUES (?, ?, ?, ?)`);

const COMMENTS_STRENGTHS = [
  "Daniel has exceptional strategic vision and consistently brings fresh, commercially grounded ideas. His ability to energise a room and get people excited about the future is a genuine strength.",
  "Outstanding at building team culture — everyone feels valued and heard. His empathy and genuine interest in people's development sets him apart as a leader.",
  "Daniel is brilliant at connecting complex dots across problems. He asks great questions and gets to the root cause quickly. Very credible with senior stakeholders.",
  "Great at painting a compelling picture of where we need to go. His personal integrity and the way he treats everyone with respect regardless of their level is exemplary.",
  "Highly creative and energetic. Daniel brings real optimism and ambition to everything he does. His stakeholder relationships are strong and he earns trust quickly.",
  "Daniel's emotional intelligence is a real asset — he reads situations well and adapts his approach accordingly. People genuinely enjoy working with him.",
];

const COMMENTS_IMPROVEMENTS = [
  "Needs to improve follow-through on initiatives once the initial excitement has passed. Some projects lose momentum when Daniel moves on to the next idea. More structured review cadences would help.",
  "Could be more proactive in building relationships across other teams. There can be a silo mentality at times — Daniel tends to focus on his own area rather than reaching out to find collaboration opportunities.",
  "Would benefit from being more decisive in difficult situations. Sometimes avoids addressing under-performance directly, which can frustrate the rest of the team who are delivering.",
  "Meeting discipline could be tighter — actions and owners aren't always clearly assigned at the end of discussions, which means things can drift. A simple follow-up process would make a big difference.",
  "Daniel could benefit from spending more time with front-line employees. The strategic thinking is excellent but ground-level insight sometimes seems to be missing from decisions.",
];

const seedAll = db.transaction(() => {
  RATERS.forEach((rater, raterIdx) => {
    // Decide if this rater has submitted (PARTIAL mode leaves last 3 as pending)
    const shouldSubmit = PARTIAL ? raterIdx < RATERS.length - 3 : true;
    const status       = shouldSubmit ? 'submitted' : (raterIdx < RATERS.length - 1 ? 'in_progress' : 'pending');
    const submittedAt  = shouldSubmit ? 'CURRENT_TIMESTAMP' : null;

    const raterResult = db.prepare(`
      INSERT INTO raters (project_id, group_id, email, name, access_code, invite_sent, invite_sent_at, status, started_at, submitted_at)
      VALUES (?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, ?, CURRENT_TIMESTAMP, ${shouldSubmit ? 'CURRENT_TIMESTAMP' : 'NULL'})
    `).run(projectId, groups[rater.group], rater.email, rater.name,
        uuid().replace(/-/g,'').slice(0,8).toUpperCase(), status);

    const raterId = raterResult.lastInsertRowid;

    if (!shouldSubmit) return; // don't add responses for pending/in-progress

    // Add scores for all questions
    questions.forEach(q => {
      const base     = BASE_SCORES[q.question_number] || 4.0;
      const variance = deterministicVariance(raterIdx, q.id) * 1.2;
      const rawScore = base + rater.bias + variance;
      const score    = clamp(round(rawScore), 1, 6);
      // ~5% chance of cannot_say
      const cannotSay = (raterIdx * q.id) % 20 === 0 ? 1 : 0;
      db.prepare(`INSERT INTO responses (rater_id, project_id, question_id, score, cannot_say) VALUES (?, ?, ?, ?, ?)`)
        .run(raterId, projectId, q.id, cannotSay ? null : score, cannotSay);
    });

    // Add constraint/risk answers
    constraintItems.forEach(item => {
      let yesProbability = 0.15; // default low
      Object.entries(BASE_CONSTRAINTS).forEach(([fragment, prob]) => {
        if (item.item_text.includes(fragment.slice(0, 15))) yesProbability = prob;
      });
      // Add rater bias and deterministic variance
      const adjustedProb = clamp(yesProbability + rater.bias * 0.3 + deterministicVariance(raterIdx, item.id) * 0.3, 0, 1);
      const answer = ((raterIdx * item.id * 7) % 100) < (adjustedProb * 100) ? 1 : 0;
      db.prepare(`INSERT INTO constraint_responses (rater_id, project_id, constraint_item_id, answer) VALUES (?, ?, ?, ?)`)
        .run(raterId, projectId, item.id, answer);
    });

    // Add comments (not every rater — about 60% leave comments)
    if ((raterIdx * 3) % 5 !== 0) {
      const strengthIdx    = raterIdx % COMMENTS_STRENGTHS.length;
      const improvementIdx = raterIdx % COMMENTS_IMPROVEMENTS.length;
      db.prepare(`INSERT INTO comments (rater_id, project_id, comment_type, comment_text) VALUES (?, ?, ?, ?)`)
        .run(raterId, projectId, 'strengths', COMMENTS_STRENGTHS[strengthIdx]);
      db.prepare(`INSERT INTO comments (rater_id, project_id, comment_type, comment_text) VALUES (?, ?, ?, ?)`)
        .run(raterId, projectId, 'improvements', COMMENTS_IMPROVEMENTS[improvementIdx]);
    }
  });

  // Update project status
  const submittedCount = PARTIAL ? RATERS.length - 3 : RATERS.length;
  db.prepare(`UPDATE projects SET status = ? WHERE id = ?`)
    .run(PARTIAL ? 'in_progress' : 'complete', projectId);
});

seedAll();

const submittedCount = db.prepare(`SELECT COUNT(*) as c FROM raters WHERE project_id = ? AND status = 'submitted'`).get(projectId).c;
const totalCount     = db.prepare(`SELECT COUNT(*) as c FROM raters WHERE project_id = ?`).get(projectId).c;

console.log(`✓ Created ${totalCount} raters (${submittedCount} submitted)`);
console.log(`✓ Seeded responses for all ${Object.keys(BASE_SCORES).length} questions`);
console.log(`✓ Seeded constraint/risk answers`);
console.log(`✓ Seeded open-ended comments`);
console.log(`\n✅ Test data ready! Project status: ${PARTIAL ? 'in_progress' : 'complete'}`);
console.log(`\n📋 Test access details:`);
console.log(`   Admin:    http://localhost:3000/admin/login`);
console.log(`   Email:    admin@motivusconsulting.co.uk`);
console.log(`   Password: motivus2026`);
console.log(`\n🔑 Rater access codes:`);

const raters = db.prepare(`
  SELECT r.name, r.email, r.access_code, r.status, rg.name as group_name
  FROM raters r JOIN rater_groups rg ON rg.id = r.group_id
  WHERE r.project_id = ? ORDER BY rg.id, r.id
`).all(projectId);

raters.forEach(r => {
  const statusIcon = r.status === 'submitted' ? '✓' : r.status === 'in_progress' ? '▶' : '○';
  console.log(`   ${statusIcon} [${r.group_name.padEnd(14)}] ${r.name.padEnd(18)} ${r.access_code}  (${r.status})`);
});

console.log(`\n   Survey URL: http://localhost:3000/survey?code=<ACCESS_CODE>`);
console.log(`   Nom URL:    http://localhost:3000/nominate?code=${nomCode}`);
console.log('\n═══════════════════════════════════\n');
