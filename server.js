import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import fs from 'fs';
import path from 'path';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

// Resolve __dirname when using ES modules
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Path to our database file
const DB_PATH = path.join(__dirname, 'data', 'db.json');

// Ensure the data directory exists so we can write to it
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

/**
 * Read the entire database JSON. Returns an object with
 * users, agents, players, transactions and bets arrays.
 */
function readDB() {
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
}

/**
 * Write the provided database object back to disk. Pretty prints
 * the output for readability.
 * @param {object} db
 */
function writeDB(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

/**
 * Seed the database with demo content. If no file exists or
 * the existing file is invalid this function is called.
 */
async function seedDB() {
  const now = new Date();
  // Create demo users: an admin and one agent
  const hashAdmin = bcrypt.hashSync('admin123', 10);
  const hashAgent = bcrypt.hashSync('agent123', 10);
  const adminId = 'admin-1';
  const agentId = 'ag-1';
  const users = [
    {
      id: adminId,
      username: 'admin',
      name: 'Administrador',
      email: 'admin@example.com',
      role: 'admin',
      password: hashAdmin,
      createdAt: now.toISOString()
    },
    {
      id: agentId,
      username: 'agent1',
      name: 'Agente Uno',
      email: 'agent1@example.com',
      role: 'agent',
      password: hashAgent,
      rate: 0.2,
      createdAt: now.toISOString()
    }
  ];

  // For convenience we'll store agents separately as well
  const agents = [
    {
      id: agentId,
      username: 'agent1',
      name: 'Agente Uno',
      email: 'agent1@example.com',
      role: 'agent',
      password: hashAgent,
      rate: 0.2,
      createdAt: now.toISOString()
    }
  ];

  // Helper functions to randomize demo data
  const firstNames = ['Juan', 'Lucía', 'Diego', 'Sofía', 'Martín', 'Carla', 'Nicolás', 'Valentina', 'Pedro', 'Florencia', 'Mauro', 'Agustina'];
  const lastNames = ['Gómez', 'Pérez', 'Rodríguez', 'López', 'Sánchez', 'Romero', 'Suárez', 'Silva', 'Torres', 'Fernández'];
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

  // Generate a set of players belonging to our demo agent
  const players = [];
  for (let i = 0; i < 40; i++) {
    const name = `${pick(firstNames)} ${pick(lastNames)}`;
    players.push({
      id: 'pl-' + uuidv4(),
      agentId: agentId,
      name,
      email: `player${i}@mail.com`,
      phone: `+598 9${rand(1000000, 9999999)}`,
      level: pick(['Bronce', 'Plata', 'Oro', 'Platino']),
      balance: parseFloat((Math.random() * 500).toFixed(2)),
      createdAt: new Date(now.getTime() - rand(1, 300) * 86400000).toISOString()
    });
  }

  // Generate a set of transactions for players
  const transactions = [];
  for (let i = 0; i < 200; i++) {
    const player = pick(players);
    const type = Math.random() > 0.5 ? 'deposit' : 'withdraw';
    const statusChance = Math.random();
    let status;
    if (statusChance > 0.85) status = 'rejected';
    else if (statusChance > 0.2) status = 'success';
    else status = 'pending';
    const amount = parseFloat((Math.random() * 400 + 20).toFixed(2));
    transactions.push({
      id: 'tx-' + uuidv4(),
      playerId: player.id,
      agentId: player.agentId,
      type,
      status,
      amount,
      createdAt: new Date(now.getTime() - rand(0, 60) * 86400000).toISOString()
    });
  }

  // Generate a set of bets
  const sports = ['Fútbol', 'Tenis', 'Basket'];
  const bets = [];
  for (let i = 0; i < 300; i++) {
    const player = pick(players);
    const stake = parseFloat((Math.random() * 120 + 5).toFixed(2));
    const odds = parseFloat((1.2 + Math.random() * 3.5).toFixed(2));
    const outcome = pick(['win', 'lose', 'open']);
    const potentialPayout = parseFloat((stake * odds).toFixed(2));
    const payout = outcome === 'win' ? potentialPayout : (outcome === 'lose' ? 0 : null);
    bets.push({
      id: 'bt-' + uuidv4(),
      playerId: player.id,
      agentId: player.agentId,
      sport: pick(sports),
      stake,
      odds,
      outcome,
      payout,
      createdAt: new Date(now.getTime() - rand(0, 45) * 86400000).toISOString()
    });
  }

  const db = { users, agents, players, transactions, bets, settings: { commissionBase: 'GGR' } };
  writeDB(db);
}

/**
 * Ensure the database exists and contains the expected structure.
 * If the file does not exist or is invalid it will be seeded.
 */
async function ensureDB() {
  if (!fs.existsSync(DB_PATH)) {
    await seedDB();
    return;
  }
  try {
    const db = readDB();
    if (!db ||
        !Array.isArray(db.users) ||
        !Array.isArray(db.players) ||
        !Array.isArray(db.transactions) ||
        !Array.isArray(db.bets) ||
        db.players.length === 0 ||
        db.bets.length === 0 ||
        db.transactions.length === 0
    ) {
      // If any core array is missing or empty, reseed the database
      await seedDB();
    }
  } catch (err) {
    await seedDB();
  }
}

// Initialize the database
await ensureDB();

const app = express();
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

// Serve static assets from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Secret for signing JWT tokens
const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';

/**
 * POST /api/auth/login
 * Authenticate a user given a username and password. Returns a JWT
 * token if the credentials are valid along with minimal user info.
 */
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  const db = readDB();
  const user = db.users.find(u => u.username === username);
  if (!user) {
    return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
  }
  if (!bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
  }
  const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '12h' });
  // Return the minimal user data to populate UI (hide password)
  const { password: pw, ...userInfo } = user;
  res.json({ token, user: userInfo });
});

/**
 * Middleware to authenticate requests using the Authorization header.
 * If the token is valid attaches user info to req.user.
 */
function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(401).json({ error: 'Missing authorization header' });
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return res.status(401).json({ error: 'Invalid authorization header' });
  const token = parts[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * GET /api/players
 * Returns a list of players. If the logged-in user is an agent
 * it filters the players by agentId.
 */
app.get('/api/players', authenticate, (req, res) => {
  const db = readDB();
  let players = db.players;
  if (req.user.role === 'agent') {
    players = players.filter(p => p.agentId === req.user.id);
  }
  res.json(players);
});

/**
 * GET /api/transactions
 * Returns a list of transactions relevant to the logged-in user.
 */
app.get('/api/transactions', authenticate, (req, res) => {
  const db = readDB();
  let txs = db.transactions;
  if (req.user.role === 'agent') {
    txs = txs.filter(tx => tx.agentId === req.user.id);
  }
  res.json(txs);
});

/**
 * GET /api/bets
 * Returns a list of bets relevant to the logged-in user.
 */
app.get('/api/bets', authenticate, (req, res) => {
  const db = readDB();
  let bets = db.bets;
  if (req.user.role === 'agent') {
    bets = bets.filter(b => b.agentId === req.user.id);
  }
  res.json(bets);
});

/**
 * GET /api/summary
 * Return aggregated metrics for the dashboard. Includes counts
 * of players, total stakes, total payouts, GGR (Gross Gaming Revenue) and
 * commission for agents. Admins see global metrics.
 */
app.get('/api/summary', authenticate, (req, res) => {
  const db = readDB();
  let players = db.players;
  let bets = db.bets;
  let userRate = 0;
  if (req.user.role === 'agent') {
    players = players.filter(p => p.agentId === req.user.id);
    bets = bets.filter(b => b.agentId === req.user.id);
    // find agent rate
    const agent = db.agents.find(a => a.id === req.user.id);
    userRate = agent ? agent.rate || 0 : 0;
  } else {
    // When admin, compute total commission over all agents
    userRate = null;
  }
  const playersCount = players.length;
  let totalStake = 0;
  let totalPayout = 0;
  bets.forEach(b => {
    totalStake += b.stake;
    if (b.payout !== null) totalPayout += b.payout;
  });
  const ggr = parseFloat((totalStake - totalPayout).toFixed(2));
  let commission = null;
  if (req.user.role === 'agent') {
    commission = parseFloat((ggr * userRate).toFixed(2));
  } else {
    // For admin compute total commission for all agents
    commission = db.agents.reduce((sum, agent) => {
      // compute ggr for each agent
      const agentBets = db.bets.filter(b => b.agentId === agent.id);
      let stakeSum = 0;
      let payoutSum = 0;
      agentBets.forEach(b => {
        stakeSum += b.stake;
        if (b.payout !== null) payoutSum += b.payout;
      });
      const agentGGR = stakeSum - payoutSum;
      return sum + agentGGR * (agent.rate || 0);
    }, 0);
    commission = parseFloat(commission.toFixed(2));
  }
  res.json({ playersCount, totalStake: parseFloat(totalStake.toFixed(2)), totalPayout: parseFloat(totalPayout.toFixed(2)), ggr, commission });
});

// Fallback: serve index.html for any unknown route (SPA support)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});