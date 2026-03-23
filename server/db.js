const Database = require('sqlite3').verbose();
const path = require('path');

const db = new Database(path.join(__dirname, 'motivus360.db'));

db.exec(`
  PRAGMA journal_mode=WAL;
  PRAGMA foreign_keys=ON;

  -- Admin users (Motivus staff)
  CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- 360 Projects (one per subject being evaluated)
  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subject_name TEXT NOT NULL,
    subject_email TEXT NOT NULL,
    company TEXT,
    status TEXT DEFAULT 'setup',
    -- setup | nominations_open | invites_sent | in_progress | complete | report_generated
    created_by INTEGER REFERENCES admins(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    deadline DATETIME,
    nomination_code TEXT UNIQUE,  -- unique code for subject to submit nominations
    nomination_submitted INTEGER DEFAULT 0
  );

  -- Rater groups
  CREATE TABLE IF NOT EXISTS rater_groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL  -- Self | Manager | Peers | Team Members | Stakeholders
  );

  -- Individual raters
  CREATE TABLE IF NOT EXISTS raters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    group_id INTEGER REFERENCES rater_groups(id),
    email TEXT NOT NULL,
    name TEXT,
    access_code TEXT UNIQUE NOT NULL,
    invite_sent INTEGER DEFAULT 0,
    invite_sent_at DATETIME,
    started_at DATETIME,
    submitted_at DATETIME,
    status TEXT DEFAULT 'pending'  -- pending | in_progress | submitted
  );

  -- Survey questions (seeded from framework)
  CREATE TABLE IF NOT EXISTS questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    section TEXT NOT NULL,
    section_title TEXT NOT NULL,
    question_number INTEGER NOT NULL,
    question_text TEXT NOT NULL,
    active INTEGER DEFAULT 1
  );

  -- Constraints and risks (yes/no items per section)
  CREATE TABLE IF NOT EXISTS constraint_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    section TEXT NOT NULL,
    item_type TEXT NOT NULL,  -- constraint | risk
    item_text TEXT NOT NULL,
    display_order INTEGER DEFAULT 0
  );

  -- Rater responses (1-6 ratings)
  CREATE TABLE IF NOT EXISTS responses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rater_id INTEGER REFERENCES raters(id) ON DELETE CASCADE,
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    question_id INTEGER REFERENCES questions(id),
    score INTEGER CHECK(score >= 1 AND score <= 6),
    cannot_say INTEGER DEFAULT 0,
    saved_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Rater constraint/risk responses (yes/no)
  CREATE TABLE IF NOT EXISTS constraint_responses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rater_id INTEGER REFERENCES raters(id) ON DELETE CASCADE,
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    constraint_item_id INTEGER REFERENCES constraint_items(id),
    answer INTEGER NOT NULL  -- 1=Yes, 0=No
  );

  -- Open-ended comments
  CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rater_id INTEGER REFERENCES raters(id) ON DELETE CASCADE,
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    comment_type TEXT NOT NULL,  -- strengths | improvements
    comment_text TEXT NOT NULL,
    saved_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Nominations submitted by the subject
  CREATE TABLE IF NOT EXISTS nominations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    group_name TEXT NOT NULL,
    email TEXT NOT NULL,
    name TEXT,
    submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// ── Seed questions from the Motivus framework ──────────────────────────────
const questionCount = db.prepare('SELECT COUNT(*) as c FROM questions').get().c;
if (questionCount === 0) {
  const insertQ = db.prepare(`
    INSERT INTO questions (section, section_title, question_number, question_text)
    VALUES (?, ?, ?, ?)
  `);

  const questions = [
    // Skill sections
    ['strategy',    'Skill: Strategy and Long Term',     1, 'Showing strategic awareness of forces shaping our future'],
    ['strategy',    'Skill: Strategy and Long Term',     2, 'Generating creative ideas about how to position us for the future'],
    ['strategy',    'Skill: Strategy and Long Term',     3, 'Building a compelling vision of what success looks like'],
    ['decision',    'Skill: Decision Making',            4, 'Connecting the dots across problems to spot recurring themes'],
    ['decision',    'Skill: Decision Making',            6, 'Getting to the root cause of complex or ambiguous problems'],
    ['action',      'Skill: Action Plans',               7, 'Making best use of everyone\'s time through effective coordination'],
    ['action',      'Skill: Action Plans',               8, 'Involving others fully in planning future changes'],
    ['action',      'Skill: Action Plans',               9, 'Translating ideas into a clear action plan with well-defined goals'],
    ['execution',   'Skill: Making Things Happen',      10, 'Maintaining rigorous disciplines to stay on top of activity and outcomes'],
    ['execution',   'Skill: Making Things Happen',      11, 'Cutting through irrelevant discussion to focus on what needs to be done'],
    ['execution',   'Skill: Making Things Happen',      12, 'Closing meetings with clear actions, owners and deadlines'],
    ['team',        'Skill: Creating a Winning Team',   13, 'Drawing on skills and motivation of others to build real team purpose'],
    ['team',        'Skill: Creating a Winning Team',   14, 'Delegating work in a way that develops and stretches others'],
    ['team',        'Skill: Creating a Winning Team',   15, 'Providing coaching and guidance to support team development'],
    ['influence',   'Skill: Communicating with Impact', 16, 'Communicating key messages effectively up, down and across the organisation'],
    ['influence',   'Skill: Communicating with Impact', 17, 'Proactively building cross-team relationships to find collaboration opportunities'],
    ['influence',   'Skill: Communicating with Impact', 18, 'Handling cross-team conflict openly and constructively'],
    // Behaviour sections
    ['integrity',   'Behaviour: Integrity and Respect', 27, 'Creating a culture of fairness and equity across the whole team'],
    ['integrity',   'Behaviour: Integrity and Respect', 28, 'Being an inspirational role model for the leadership behaviours we need'],
    ['integrity',   'Behaviour: Integrity and Respect', 29, 'Regularly going out to meet and listen to front-line employees'],
    ['integrity',   'Behaviour: Integrity and Respect', 30, 'Treating everyone with respect regardless of their level or status'],
    ['resilience',  'Behaviour: Resilience',            31, 'Speaking up to say what others are thinking but not saying aloud'],
    ['resilience',  'Behaviour: Resilience',            32, 'Tackling under-performance that others may be ignoring'],
    ['resilience',  'Behaviour: Resilience',            33, 'Persevering with difficult tasks and refusing to be deflected'],
    ['resilience',  'Behaviour: Resilience',            34, 'Adapting my approach to suit different people and situations'],
    ['impact',      'Behaviour: Impact',                35, 'Running energetic sessions that involve everyone and spark creative thinking'],
    ['impact',      'Behaviour: Impact',                36, 'Publicly sharing my views and standing behind what I believe'],
    ['impact',      'Behaviour: Impact',                37, 'Setting bold goals that challenge the status quo and raise ambition'],
    ['impact',      'Behaviour: Impact',                38, 'Driving a bold agenda for change to transform effectiveness and efficiency'],
    ['eq',          'Behaviour: Emotional Intellect',   39, 'Recognising how my own emotions are influencing my behaviour and decisions in the moment'],
    ['eq',          'Behaviour: Emotional Intellect',   40, 'Staying calm, measured and in control of my emotional reactions under pressure or when challenged'],
    ['eq',          'Behaviour: Emotional Intellect',   41, 'Showing genuine empathy — picking up on how others are feeling and responding with sensitivity'],
    ['eq',          'Behaviour: Emotional Intellect',   42, 'Building trust and psychological safety so that people feel comfortable speaking openly'],
    ['credibility', 'Behaviour: Credibility',           19, 'Establishing a strong presence among peers and leading on key decisions'],
    ['credibility', 'Behaviour: Credibility',           20, 'Overcoming resistance to make things happen'],
    ['credibility', 'Behaviour: Credibility',           21, 'Using personal influence to bring difficult colleagues on board'],
    ['credibility', 'Behaviour: Credibility',           22, 'Earning respect by delivering on commitments made to peers and stakeholders'],
  ];

  const insertMany = db.transaction((qs) => {
    for (const [sec, title, num, text] of qs) insertQ.run(sec, title, num, text);
  });
  insertMany(questions);

  // Seed constraints and risks
  const insertC = db.prepare(`INSERT INTO constraint_items (section, item_type, item_text, display_order) VALUES (?, ?, ?, ?)`);
  const constraints = [
    ['strategy',   'constraint', 'Getting caught up in short-term fire-fighting', 1],
    ['strategy',   'constraint', 'Losing touch with broader external trends', 2],
    ['strategy',   'risk',       'Generating ambitious plans that neglect current realities', 1],
    ['strategy',   'risk',       'Introducing ideas but losing interest in follow-through', 2],
    ['decision',   'constraint', 'Deciding before fully exploring all options', 1],
    ['decision',   'constraint', 'Jumping to conclusions to do what I already want', 2],
    ['decision',   'risk',       'Seeking perfection and slowing decision-making', 1],
    ['decision',   'risk',       'Over-complicating simple issues with unnecessary analysis', 2],
    ['action',     'constraint', 'Changing the message and confusing others about priorities', 1],
    ['action',     'constraint', 'Spreading effort too thinly across too many things', 2],
    ['action',     'risk',       'Implementing rigid planning systems that cannot flex', 1],
    ['action',     'risk',       'Sticking with the plan rather than adapting to shifting priorities', 2],
    ['execution',  'constraint', 'Allowing projects to drift and lose momentum', 1],
    ['execution',  'constraint', 'Letting discussions go in circles without practical conclusions', 2],
    ['execution',  'risk',       'Putting excessive pressure on colleagues to deliver', 1],
    ['execution',  'risk',       'Moving too fast and losing stakeholder support', 2],
    ['team',       'constraint', 'Focusing on problems rather than recognising positives', 1],
    ['team',       'constraint', 'Avoiding team tensions rather than resolving them', 2],
    ['team',       'risk',       'Giving individuals with grievances too much airtime', 1],
    ['team',       'risk',       'Pursuing consensus at the expense of timely decisions', 2],
    ['influence',  'constraint', 'Focusing only on my own area and neglecting key interfaces', 1],
    ['influence',  'constraint', 'Allowing a "them and us" attitude to develop between teams', 2],
    ['influence',  'risk',       'Over-consulting and losing sight of key priorities', 1],
    ['influence',  'risk',       'Making poor compromises to accommodate competing demands', 2],
    ['integrity',  'constraint', 'Letting personal feelings influence my judgement', 1],
    ['integrity',  'constraint', 'Expecting others to drop everything to respond to my requests', 2],
    ['integrity',  'constraint', 'Being reluctant to tackle behaviour that undermines our values', 3],
    ['integrity',  'risk',       'Being overly dogmatic about my views', 1],
    ['integrity',  'risk',       'Mistaking personal preferences for ethical principles', 2],
    ['integrity',  'risk',       'Allowing others to take advantage of my good nature', 3],
    ['resilience', 'constraint', 'Avoiding issues that might create disagreement or conflict', 1],
    ['resilience', 'constraint', 'Saying what people want to hear rather than what needs saying', 2],
    ['resilience', 'constraint', 'Getting distracted by peripheral issues and losing focus', 3],
    ['resilience', 'risk',       'Pushing so hard I bulldoze others into agreement', 1],
    ['resilience', 'risk',       'Expressing views too forcefully and alienating colleagues', 2],
    ['resilience', 'risk',       'Becoming too narrowly focused on my own priorities', 3],
    ['impact',     'constraint', 'Keeping a low profile and staying in the background', 1],
    ['impact',     'constraint', 'Holding back views until I have read the room', 2],
    ['impact',     'constraint', 'Seeking short-term compromise rather than the right long-term outcome', 3],
    ['impact',     'risk',       'Getting ahead of others and creating false expectations', 1],
    ['impact',     'risk',       'Insisting on doing things on my own terms', 2],
    ['impact',     'risk',       'Taking positions that distance me from collective decisions', 3],
    ['eq',         'constraint', 'Allowing personal stress or frustration to visibly affect the team climate', 1],
    ['eq',         'constraint', 'Missing emotional signals from others and responding insensitively', 2],
    ['eq',         'constraint', 'Becoming defensive or dismissive when receiving critical feedback', 3],
    ['eq',         'risk',       'Over-relying on emotional instincts at the expense of rational analysis', 1],
    ['eq',         'risk',       'Using empathy to avoid necessary but difficult conversations', 2],
    ['eq',         'risk',       'Creating an environment where challenge is discouraged in favour of harmony', 3],
    ['credibility','constraint', 'Allowing more dominant colleagues to undermine my position', 1],
    ['credibility','constraint', 'Struggling to stand out and be noticed', 2],
    ['credibility','risk',       'Over-committing to challenges outside my expertise', 1],
    ['credibility','risk',       "Displaying arrogance that dismisses others' contributions", 2],
  ];
  const insertCMany = db.transaction((cs) => { for (const c of cs) insertC.run(...c); });
  insertCMany(constraints);

  // Seed default admin
  const bcrypt = require('bcryptjs');
  const hash = bcrypt.hashSync('motivus2026', 10);
  db.prepare(`INSERT OR IGNORE INTO admins (email, password_hash, name) VALUES (?, ?, ?)`)
    .run('admin@motivusconsulting.co.uk', hash, 'Motivus Admin');

  console.log('✓ Database seeded');
}

module.exports = db;
