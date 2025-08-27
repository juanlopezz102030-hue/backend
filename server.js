// Express + SQLite + JWT + Bcrypt
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// --- DB ---
const dbPath = process.env.DB_PATH || path.join(__dirname, 'cayo.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(()=>{
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    role TEXT NOT NULL DEFAULT 'player',
    chips REAL NOT NULL DEFAULT 0,
    deposits INTEGER NOT NULL DEFAULT 0
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS admins (
    email TEXT PRIMARY KEY,
    passhash TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'admin'
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS txs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL, -- deposit/withdraw/adjust
    amount REAL NOT NULL,
    created_at INTEGER NOT NULL
  )`);

  // Seed admin if not exists
  const email = process.env.ADMIN_EMAIL || 'admin@cayo.local';
  const pass = process.env.ADMIN_PASSWORD || 'admin123';
  const name = process.env.ADMIN_NAME || 'Admin';
  db.get('SELECT email FROM admins WHERE email=?', [email], (err,row)=>{
    if (!row){
      const hash = bcrypt.hashSync(pass, 10);
      db.run('INSERT INTO admins(email, passhash, name, role) VALUES(?,?,?,?)', [email, hash, name, 'admin']);
      console.log('Seeded admin:', email);
    }
  });

  // Seed wallet if missing
  db.get('SELECT value FROM settings WHERE key=?', ['wallet'], (err,row)=>{
    if (!row){
      db.run('INSERT INTO settings(key,value) VALUES(?,?)', ['wallet', JSON.stringify({ amount: 2004 })]);
    }
  });

  // Seed some users if empty
  db.get('SELECT COUNT(*) as n FROM users', (err,row)=>{
    if (row && row.n === 0){
      const seed = [
        ['Carloscayo1','player',1.40,2],
        ['marpelu98','player',100.32,19],
        ['louycayo','player',1.33,18],
        ['Pepecayo','player',6.04,31],
        ['maurocayo4','player',346.95,25],
        ['Leon2228','player',1659.00,5],
      ];
      const stmt = db.prepare('INSERT INTO users(id,role,chips,deposits) VALUES(?,?,?,?)');
      for(const s of seed) stmt.run(s);
      stmt.finalize();
    }
  });
});

// --- Helpers ---
const JWT_SECRET = process.env.JWT_SECRET || 'change-me-secret';
function signToken(payload){ return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' }); }
function auth(req,res,next){
  const h = req.headers.authorization||'';
  const t = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!t) return res.status(401).send('No autorizado');
  try{ req.user = jwt.verify(t, JWT_SECRET); next(); }
  catch(e){ return res.status(401).send('Token inválido'); }
}
function onlyAdmin(req,res,next){
  if (req.user?.role !== 'admin') return res.status(403).send('Requiere rol admin');
  next();
}

// --- Auth ---
app.post('/auth/login', (req,res)=>{
  const { email, password } = req.body||{};
  if (!email || !password) return res.status(400).send('Faltan credenciales');
  db.get('SELECT * FROM admins WHERE email=?', [email], (err,row)=>{
    if (!row) return res.status(401).send('Credenciales inválidas');
    const ok = bcrypt.compareSync(password, row.passhash);
    if (!ok) return res.status(401).send('Credenciales inválidas');
    const user = { email: row.email, name: row.name, role: row.role };
    const accessToken = signToken(user);
    res.json({ accessToken, user });
  });
});

app.get('/auth/me', auth, (req,res)=>{
  res.json(req.user);
});

// --- Stats ---
app.get('/stats/wallet', auth, (req,res)=>{
  db.get('SELECT value FROM settings WHERE key=?', ['wallet'], (err,row)=>{
    const val = row ? JSON.parse(row.value) : { amount: 0 };
    res.json(val);
  });
});

// --- Users ---
app.get('/users', auth, (req,res)=>{
  const q = (req.query.q||'').toLowerCase();
  const role = req.query.role||'';
  const page = Number(req.query.page||1);
  const pageSize = Number(req.query.pageSize||10);
  const where = [];
  const params = [];
  if (q){ where.push('LOWER(id) LIKE ?'); params.push('%'+q+'%'); }
  if (role){ where.push('role = ?'); params.push(role); }
  const whereSql = where.length ? ('WHERE '+where.join(' AND ')) : '';
  db.get('SELECT COUNT(*) as total FROM users '+whereSql, params, (err, meta)=>{
    db.all('SELECT * FROM users '+whereSql+' ORDER BY id LIMIT ? OFFSET ?', params.concat([pageSize, (page-1)*pageSize]), (err2, rows)=>{
      res.json({ rows, total: meta.total, page, pageSize });
    });
  });
});

app.post('/users', auth, onlyAdmin, (req,res)=>{
  const { id, role='player' } = req.body||{};
  if (!id) return res.status(400).send('ID requerido');
  db.run('INSERT INTO users(id, role, chips, deposits) VALUES(?,?,0,0)', [id, role], function(err){
    if (err) return res.status(409).send('ID duplicado');
    db.get('SELECT * FROM users WHERE id=?', [id], (e,row)=> res.json(row));
  });
});

app.patch('/users/:id', auth, (req,res)=>{
  const { id } = req.params;
  const { role, chips, deposits } = req.body||{};
  db.get('SELECT * FROM users WHERE id=?', [id], (err,row)=>{
    if (!row) return res.status(404).send('No existe');
    const newRole = role ?? row.role;
    const newChips = typeof chips==='number' ? chips : row.chips;
    const newDeps = typeof deposits==='number' ? deposits : row.deposits;
    db.run('UPDATE users SET role=?, chips=?, deposits=? WHERE id=?', [newRole, newChips, newDeps, id], function(e){
      db.get('SELECT * FROM users WHERE id=?', [id], (e2,row2)=> res.json(row2));
    });
  });
});

app.post('/users/:id/deposits', auth, (req,res)=>{
  const { id } = req.params;
  const amount = Number(req.body?.amount||0);
  if (!(amount>0)) return res.status(400).send('Monto inválido');
  db.get('SELECT * FROM users WHERE id=?', [id], (err,row)=>{
    if (!row) return res.status(404).send('No existe');
    const chips = +(row.chips + amount).toFixed(2);
    const deposits = row.deposits + 1;
    db.run('UPDATE users SET chips=?, deposits=? WHERE id=?', [chips, deposits, id]);
    // tx
    db.run('INSERT INTO txs(user_id, type, amount, created_at) VALUES(?,?,?,?)', [id, 'deposit', amount, Date.now()]);
    // wallet
    db.get('SELECT value FROM settings WHERE key=?', ['wallet'], (e,r)=>{
      const v = r ? JSON.parse(r.value) : { amount: 0 };
      v.amount = +(v.amount + amount);
      db.run('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', ['wallet', JSON.stringify(v)]);
      res.json({ ok:true, user:{ id, role: row.role, chips, deposits }, wallet: v });
    });
  });
});

const port = process.env.PORT || 4000;
app.listen(port, ()=> console.log('API en http://localhost:'+port));