const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = process.env.DATABASE_URL || path.join(__dirname, 'motivus360.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run('PRAGMA journal_mode=WAL');
  db.run('PRAGMA foreign_keys=ON');
  db.run(`CREATE TABLE IF NOT EXISTS admins (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, name TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
  db.run(`CREATE TABLE IF NOT EXISTS projects (id INTEGER PRIMARY KEY AUTOINCREMENT, subject_name TEXT NOT NULL, subject_email TEXT, company TEXT, status TEXT DEFAULT 'setup', deadline DATE, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, created_by INTEGER)`);
  db.run(`CREATE TABLE IF NOT EXISTS raters (id INTEGER PRIMARY KEY AUTOINCREMENT, project_id INTEGER NOT NULL, name TEXT, email TEXT NOT NULL, group_type TEXT NOT NULL, access_code TEXT UNIQUE NOT NULL, status TEXT DEFAULT 'pending', invited_at DATETIME, submitted_at DATETIME, FOREIGN KEY(project_id) REFERENCES projects(id))`);
  db.run(`CREATE TABLE IF NOT EXISTS responses (id INTEGER PRIMARY KEY AUTOINCREMENT, rater_id INTEGER NOT NULL, section TEXT NOT NULL, question_index INTEGER NOT NULL, score INTEGER, FOREIGN KEY(rater_id) REFERENCES raters(id))`);
  db.run(`CREATE TABLE IF NOT EXISTS constraints_responses (id INTEGER PRIMARY KEY AUTOINCREMENT, rater_id INTEGER NOT NULL, section TEXT NOT NULL, constraint_index INTEGER NOT NULL, answer INTEGER NOT NULL, FOREIGN KEY(rater_id) REFERENCES raters(id))`);
  db.run(`CREATE TABLE IF NOT EXISTS comments (id INTEGER PRIMARY KEY AUTOINCREMENT, rater_id INTEGER NOT NULL, section TEXT NOT NULL, strengths TEXT, improvements TEXT, FOREIGN KEY(rater_id) REFERENCES raters(id))`);
  db.run(`CREATE TABLE IF NOT EXISTS nominations (id INTEGER PRIMARY KEY AUTOINCREMENT, project_id INTEGER NOT NULL, name TEXT NOT NULL, email TEXT NOT NULL, group_type TEXT NOT NULL, status TEXT DEFAULT 'pending')`);

  const hash = bcrypt.hashSync('motivus2026', 10);
  db.run(`INSERT OR IGNORE INTO admins (email, password_hash, name) VALUES (?, ?, ?)`, ['admin@motivusconsulting.co.uk', hash, 'Motivus Admin']);
});

// Helper to run queries
db.asyncGet = (sql, params=[]) => new Promise((resolve, reject) => db.get(sql, params, (err, row) => err ? reject(err) : resolve(row)));
db.asyncAll = (sql, params=[]) => new Promise((resolve, reject) => db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows)));
db.asyncRun = (sql, params=[]) => new Promise((resolve, reject) => db.run(sql, params, function(err) { err ? reject(err) : resolve({lastID: this.lastID, changes: this.changes}); }));

console.log('✓ Database initialised');
module.exports = db;
