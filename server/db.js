const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

async function initDB() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS admins (
        id SERIAL PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        name TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS projects (
        id SERIAL PRIMARY KEY,
        subject_name TEXT NOT NULL,
        subject_email TEXT,
        company TEXT,
        status TEXT DEFAULT 'setup',
        deadline DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_by INTEGER
      );
      CREATE TABLE IF NOT EXISTS raters (
        id SERIAL PRIMARY KEY,
        project_id INTEGER NOT NULL REFERENCES projects(id),
        name TEXT,
        email TEXT NOT NULL,
        group_type TEXT NOT NULL,
        access_code TEXT UNIQUE NOT NULL,
        status TEXT DEFAULT 'pending',
        invited_at TIMESTAMP,
        submitted_at TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS responses (
        id SERIAL PRIMARY KEY,
        rater_id INTEGER NOT NULL REFERENCES raters(id),
        section TEXT NOT NULL,
        question_index INTEGER NOT NULL,
        score INTEGER
      );
      CREATE TABLE IF NOT EXISTS constraints_responses (
        id SERIAL PRIMARY KEY,
        rater_id INTEGER NOT NULL REFERENCES raters(id),
        section TEXT NOT NULL,
        constraint_index INTEGER NOT NULL,
        answer INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS comments (
        id SERIAL PRIMARY KEY,
        rater_id INTEGER NOT NULL REFERENCES raters(id),
        section TEXT NOT NULL,
        strengths TEXT,
        improvements TEXT
      );
      CREATE TABLE IF NOT EXISTS nominations (
        id SERIAL PRIMARY KEY,
        project_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        group_type TEXT NOT NULL,
        status TEXT DEFAULT 'pending'
      );
    `);

    const hash = bcrypt.hashSync('motivus2026', 10);
    await client.query(
      `INSERT INTO admins (email, password_hash, name) VALUES ($1, $2, $3) ON CONFLICT (email) DO NOTHING`,
      ['admin@motivusconsulting.co.uk', hash, 'Motivus Admin']
    );

    console.log('✓ Database initialised');
  } finally {
    client.release();
  }
}

initDB().catch(console.error);

module.exports = {
  query: (text, params) => pool.query(text, params),
  getClient: () => pool.connect()
};
