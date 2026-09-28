import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import mysql from 'mysql2/promise';

const app = express();
const port = Number(process.env.PORT || 4000);

const mysqlConfig = {
  host: process.env.MYSQL_HOST || '127.0.0.1',
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'feedants',
};

let pool = null;
let useFallback = false;

// ─── Rich seed data ────────────────────────────────────────────────────────
const seedData = {
  id: 'classical-dance',
  title: 'Feedants Classical Dance',
  category: 'Dance',
  type: 'Multi-Win',
  prizePool: 1500,
  entryFee: 99,
  capacity: 20,
  booked: 1,
  hasCertificate: true,
  referralLink: 'https://feedants.com/r/referral123',
  referralEarning: 10,
  registrationClosesAt: '2026-10-10T23:50:00.000Z',
  submissionStartsAt: '2026-10-06T04:00:00.000Z',
  submissionEndsAt: '2026-10-30T23:55:00.000Z',
  resultDate: '2026-11-01T23:50:00.000Z',
  description: 'This is an online classical dance competition open for all age groups. Participate from anywhere and showcase your talent. Express your passion through traditional dance. This competition celebrates the rich heritage of Indian classical arts — from Bharatanatyam to Kathak, all forms are welcome.',
  judgingParameters: 'Entries will be evaluated on: \n\n• Technique & Precision (25%) — Accuracy of footwork, hand gestures (mudras), and body posture.\n\n• Expression & Abhinaya (25%) — Emotional conveyance and storytelling through facial expression and movement.\n\n• Rhythm & Musicality (20%) — Synchronization with the music and tala (rhythmic cycle).\n\n• Presentation & Costume (15%) — Stage presence, attire appropriateness, and overall visual impact.\n\n• Originality & Creativity (15%) — Unique choreography, innovative interpretation, and artistic flair.',
  rulesEligibility: '• Open to all age groups and nationalities.\n• Solo performances only (group entries not accepted).\n• Video duration: Minimum 2 minutes, Maximum 5 minutes.\n• Accepted formats: MP4 or MOV, max 500 MB.\n• Only one submission per participant.\n• Submission must be an original performance recorded specifically for this competition.\n• Background music must be properly licensed or original compositions.\n• Entries using prohibited content will be disqualified.\n• Decision of judges shall be final and binding.',
  disclaimer: 'Only contributions from paid participants will be considered for judging. Feedants reserves the right to disqualify any entry violating the competition guidelines.',
  judge: {
    name: 'Manju Dubey',
    specialty: 'Professional Kathak Dancer',
    experience: '12+ Years of Experience',
    bio: 'Manju Dubey is a renowned Kathak exponent trained under Pandit Birju Maharaj. She has performed at over 200 national and international stages and has trained 500+ students in classical dance.',
    avatarColor: '#c2410c',
    avatarInitials: 'MD',
    introVideoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  },
  winners: [
    { name: 'Riya Shah',     place: '1st Winner', edition: '2025', avatarColor: '#b45309', avatarInitials: 'RS' },
    { name: 'Aarav Mehta',   place: '1st Winner', edition: '2024', avatarColor: '#1d4ed8', avatarInitials: 'AM' },
    { name: 'Neha Verma',    place: '2nd Winner', edition: '2025', avatarColor: '#7c3aed', avatarInitials: 'NV' },
    { name: 'Ishita Chopra', place: '3rd Winner', edition: '2024', avatarColor: '#047857', avatarInitials: 'IC' },
  ],
  rewards: [
    { place: '1st Winner', amount: 550, icon: '🏆' },
    { place: '2nd Winner', amount: 300, icon: '🥈' },
    { place: '3rd Winner', amount: 240, icon: '🥉' },
    { place: '4th Winner', amount: 200, icon: '⭐' },
    { place: '5th Winner', amount: 130, icon: '⭐' },
    { place: '6th Winner', amount: 80,  icon: '⭐' },
  ],
  testimonials: [
    { name: 'Riya Shah',   text: 'Feedants made everything seamless! Got my certificate and prize within 2 days of the results.',   rating: 5 },
    { name: 'Priya Nair',  text: 'Best online dance competition platform. Fair judging, smooth submission process, would recommend!', rating: 5 },
    { name: 'Arjun Gupta', text: 'Great experience participating. The feedback from the judge was incredibly valuable.',              rating: 4 },
  ],
  paymentInfo: {
    gateway: 'Razorpay',
    refundPolicy: 'Full refund if competition is cancelled. No refund after submission deadline.',
    prizeTransferMethod: 'UPI / Bank Transfer within 48 hours of result announcement.',
  },
};

// ─── Memory fallback ───────────────────────────────────────────────────────
const memoryStore = {
  competition: JSON.parse(JSON.stringify(seedData)),
  registrations: new Set(),
};

app.use(cors());
app.use(express.json());

const json = (v) => JSON.stringify(v);
const parseJson = (v) => (typeof v === 'string' ? JSON.parse(v) : v);
const iso = (v) => new Date(v).toISOString();
const isOpen = (c) => new Date(c.registrationClosesAt).getTime() > Date.now();

const serializeRow = (row) => ({
  id: row.id,
  title: row.title,
  category: row.category,
  type: row.type,
  prizePool: Number(row.prize_pool),
  entryFee: Number(row.entry_fee),
  capacity: row.capacity,
  booked: row.booked,
  hasCertificate: Boolean(row.has_certificate),
  referralLink: row.referral_link,
  referralEarning: Number(row.referral_earning),
  registrationClosesAt: iso(row.registration_closes_at),
  submissionStartsAt: iso(row.submission_starts_at),
  submissionEndsAt: iso(row.submission_ends_at),
  resultDate: iso(row.result_date),
  description: row.description,
  judgingParameters: row.judging_parameters || '',
  rulesEligibility: row.rules_eligibility || '',
  disclaimer: row.disclaimer || '',
  judge: parseJson(row.judge),
  winners: parseJson(row.winners),
  rewards: parseJson(row.rewards),
  testimonials: parseJson(row.testimonials) || [],
  paymentInfo: parseJson(row.payment_info) || { gateway: 'Payment provider', refundPolicy: 'See competition terms.', prizeTransferMethod: 'See competition terms.' },
});

// ─── DB Init ───────────────────────────────────────────────────────────────
async function initDB() {
  try {
    const root = await mysql.createConnection({
      host: mysqlConfig.host, port: mysqlConfig.port,
      user: mysqlConfig.user, password: mysqlConfig.password,
    });
    await root.query(`CREATE DATABASE IF NOT EXISTS \`${mysqlConfig.database}\``);
    await root.end();

    pool = mysql.createPool({ ...mysqlConfig, waitForConnections: true, connectionLimit: 10, queueLimit: 0 });

    await pool.query(`CREATE TABLE IF NOT EXISTS competitions (
      id                    VARCHAR(100) PRIMARY KEY,
      title                 VARCHAR(255) NOT NULL,
      category              VARCHAR(100) NOT NULL,
      type                  VARCHAR(100) NOT NULL DEFAULT 'Standard',
      prize_pool            DECIMAL(10,2) NOT NULL,
      entry_fee             DECIMAL(10,2) NOT NULL,
      capacity              INT NOT NULL,
      booked                INT NOT NULL DEFAULT 0,
      has_certificate       TINYINT(1) NOT NULL DEFAULT 0,
      referral_link         VARCHAR(500) DEFAULT NULL,
      referral_earning      DECIMAL(10,2) NOT NULL DEFAULT 0,
      registration_closes_at DATETIME NOT NULL,
      submission_starts_at  DATETIME NOT NULL,
      submission_ends_at    DATETIME NOT NULL,
      result_date           DATETIME NOT NULL,
      description           TEXT NOT NULL,
      judging_parameters    TEXT NOT NULL,
      rules_eligibility     TEXT NOT NULL,
      disclaimer            TEXT NOT NULL,
      judge                 JSON NOT NULL,
      winners               JSON NOT NULL,
      rewards               JSON NOT NULL,
      testimonials          JSON NOT NULL DEFAULT ('[]'),
      payment_info          JSON NOT NULL DEFAULT ('{}')
    )`);

    const columns = [
      ['type', "VARCHAR(100) NOT NULL DEFAULT 'Standard'"],
      ['has_certificate', 'TINYINT(1) NOT NULL DEFAULT 0'],
      ['referral_link', 'VARCHAR(500) DEFAULT NULL'],
      ['referral_earning', 'DECIMAL(10,2) NOT NULL DEFAULT 0'],
      ['judging_parameters', 'TEXT NULL'],
      ['rules_eligibility', 'TEXT NULL'],
      ['disclaimer', 'TEXT NULL'],
      ['testimonials', 'JSON NULL'],
      ['payment_info', 'JSON NULL'],
    ];
    for (const [name, definition] of columns) {
      const [existing] = await pool.query(
        'SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?',
        ['competitions', name]
      );
      if (!existing.length) await pool.query(`ALTER TABLE competitions ADD COLUMN ${name} ${definition}`);
    }

    await pool.query(`CREATE TABLE IF NOT EXISTS registrations (
      competition_id VARCHAR(100) NOT NULL,
      user_id        VARCHAR(255) NOT NULL,
      created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (competition_id, user_id),
      FOREIGN KEY (competition_id) REFERENCES competitions(id)
    )`);

    await pool.query(
      `INSERT INTO competitions
        (id,title,category,type,prize_pool,entry_fee,capacity,booked,has_certificate,referral_link,referral_earning,
         registration_closes_at,submission_starts_at,submission_ends_at,result_date,
         description,judging_parameters,rules_eligibility,disclaimer,judge,winners,rewards,testimonials,payment_info)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE id = id`,
      [
        seedData.id, seedData.title, seedData.category, seedData.type,
        seedData.prizePool, seedData.entryFee, seedData.capacity, seedData.booked,
        seedData.hasCertificate ? 1 : 0, seedData.referralLink, seedData.referralEarning,
        new Date(seedData.registrationClosesAt), new Date(seedData.submissionStartsAt),
        new Date(seedData.submissionEndsAt), new Date(seedData.resultDate),
        seedData.description, seedData.judgingParameters, seedData.rulesEligibility, seedData.disclaimer,
        json(seedData.judge), json(seedData.winners), json(seedData.rewards),
        json(seedData.testimonials), json(seedData.paymentInfo),
      ]
    );

    console.log(`✅ MySQL connected → database "${mysqlConfig.database}" at ${mysqlConfig.host}:${mysqlConfig.port}`);
  } catch (err) {
    console.warn(`⚠️  MySQL unavailable (${err.message}). Using in-memory fallback.`);
    useFallback = true;
  }
}

// ─── Routes ────────────────────────────────────────────────────────────────
app.get('/api/health', async (_req, res) => {
  if (!useFallback && pool) {
    try { await pool.query('SELECT 1'); return res.json({ ok: true, storage: 'mysql' }); }
    catch { return res.status(503).json({ ok: false, storage: 'mysql' }); }
  }
  return res.json({ ok: true, storage: 'memory' });
});

app.get('/api/competitions/:key', async (req, res) => {
  const userId = req.query.userId || 'anonymous';
  const key = req.params.key;

  if (!useFallback && pool) {
    try {
      const [rows] = await pool.query('SELECT * FROM competitions WHERE id = ?', [key]);
      if (!rows[0]) return res.status(404).json({ message: 'Competition not found' });
      const competition = serializeRow(rows[0]);
      const [regs] = await pool.query(
        'SELECT 1 FROM registrations WHERE competition_id = ? AND user_id = ? LIMIT 1',
        [key, userId]
      );
      return res.json({ competition, registered: regs.length > 0, registrationOpen: isOpen(competition) });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ message: 'Server error.' });
    }
  }

  if (memoryStore.competition.id !== key) return res.status(404).json({ message: 'Not found' });
  return res.json({
    competition: memoryStore.competition,
    registered: memoryStore.registrations.has(userId),
    registrationOpen: isOpen(memoryStore.competition),
  });
});

app.post('/api/competitions/:key/register', async (req, res) => {
  const { userId } = req.body ?? {};
  const key = req.params.key;
  if (!userId) return res.status(400).json({ message: 'userId is required' });

  if (!useFallback && pool) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [rows] = await conn.query('SELECT * FROM competitions WHERE id = ? FOR UPDATE', [key]);
      if (!rows[0]) { await conn.rollback(); return res.status(404).json({ message: 'Competition not found.' }); }
      const c = serializeRow(rows[0]);
      if (!isOpen(c)) { await conn.rollback(); return res.status(409).json({ message: 'Registration is closed.' }); }
      if (c.booked >= c.capacity) { await conn.rollback(); return res.status(409).json({ message: 'All spots are booked.' }); }
      const [ex] = await conn.query('SELECT 1 FROM registrations WHERE competition_id=? AND user_id=? LIMIT 1', [key, userId]);
      if (ex.length) { await conn.rollback(); return res.status(409).json({ message: 'Already registered.' }); }
      await conn.query('INSERT INTO registrations (competition_id, user_id) VALUES (?, ?)', [key, userId]);
      await conn.query('UPDATE competitions SET booked = booked + 1 WHERE id = ?', [key]);
      await conn.commit();
      return res.status(201).json({ registered: true, booked: c.booked + 1 });
    } catch (e) {
      await conn.rollback();
      return res.status(500).json({ message: 'Registration failed.' });
    } finally { conn.release(); }
  }

  if (memoryStore.competition.id !== key) return res.status(404).json({ message: 'Not found' });
  if (!isOpen(memoryStore.competition)) return res.status(409).json({ message: 'Registration closed.' });
  if (memoryStore.competition.booked >= memoryStore.competition.capacity) return res.status(409).json({ message: 'All spots booked.' });
  if (memoryStore.registrations.has(userId)) return res.status(409).json({ message: 'Already registered.' });
  memoryStore.registrations.add(userId);
  memoryStore.competition.booked += 1;
  return res.status(201).json({ registered: true, booked: memoryStore.competition.booked });
});

// ─── Start ─────────────────────────────────────────────────────────────────
initDB().then(() => app.listen(port, () => console.log(`🚀 Feedants API → http://localhost:${port}`)));
