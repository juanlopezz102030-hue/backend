import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import morgan from 'morgan';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import url from 'url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

const DB_PATH = path.join(__dirname, 'data', 'db.json');
function readDB() { return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8')); }
function writeDB(db) { fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2)); }

const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));
app.use(express.static(path.join(__dirname, 'public')));

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';
const TOKEN_EXPIRES = '12h';

function signToken(user){ return jwt.sign({ id:user.id, role:user.role, username:user.username }, JWT_SECRET, { expiresIn:TOKEN_EXPIRES }); }
function authRequired(req,res,next){
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error:'No token' });
  try { req.user = jwt.verify(token, JWT_SECRET); next(); }
  catch(e){ return res.status(401).json({ error:'Invalid token' }); }
}
function paginate(arr, page=1, perPage=20){
  const total = arr.length; const pages = Math.ceil(total/perPage)||1;
  const p = Math.min(Math.max(Number(page),1), pages);
  const start = (p-1)*perPage;
  return { data: arr.slice(start,start+perPage), page:p, perPage:Number(perPage), total, pages };
}

// Seed if empty
if (!fs.existsSync(DB_PATH)) {
  const hashAdmin = bcrypt.hashSync('admin123', 10);
  const hashAgent = bcrypt.hashSync('agent123', 10);
  const now = new Date().toISOString();
  const agents = [{ id:'ag-1', username:'agent1', name:'Agente Uno', email:'agent1@example.com', role:'agent', password:hashAgent, rate:0.2, createdAt:now }];
  const users = [{ id:'admin-1', username:'admin', name:'Administrador', email:'admin@example.com', role:'admin', password:hashAdmin, createdAt:now }, ...agents];
  function rand(a,b){ return Math.floor(Math.random()*(b-a+1))+a; }
  function pick(arr){ return arr[rand(0,arr.length-1)]; }
  const names = ['Juan','Lucía','Diego','Sofía','Martín','Carla','Nicolás','Valentina','Pedro','Florencia','Mauro','Agustina'];
  const last = ['Gómez','Pérez','Rodríguez','López','Sánchez','Romero','Suárez','Silva','Torres','Fernández'];
  const levels = ['Bronce','Plata','Oro','Platino'];
  const players = [];
  for (let i=0;i<60;i++){
    const name = `${pick(names)} ${pick(last)}`;
    players.push({ id:'pl-'+uuidv4(), agentId:'ag-1', name, email:`p${i}@mail.com`, phone:`+598 9${rand(1000000,9999999)}`, level:pick(levels), balance:+(Math.random()*500).toFixed(2), createdAt:new Date(Date.now()-rand(1,300)*86400000).toISOString() });
  }
  const transactions = [];
  for (let i=0;i<300;i++){
    const p = pick(players);
    const type = Math.random()>0.5?'deposit':'withdraw';
    const status = Math.random()>0.85?'rejected':(Math.random()>0.2?'success':'pending');
    const amount = +(Math.random()*400+20).toFixed(2);
    transactions.push({ id:'tx-'+uuidv4(), playerId:p.id, agentId:p.agentId, type, status, amount, createdAt:new Date(Date.now()-rand(0,60)*86400000).toISOString() });
  }
  const sports = ['Fútbol','Tenis','Basket'];
  const bets = [];
  for (let i=0;i<500;i++){
    const p = pick(players);
    const stake = +(Math.random()*120+5).toFixed(2);
    const odds = +(1.2 + Math.random()*3.5).toFixed(2);
    const outcome = pick(['win','lose','open']);
    const potential = +(stake*odds).toFixed(2);
    const payout = outcome==='win'?potential:(outcome==='lose'?0:null);
    bets.push({ id:'bt-'+uuidv4(), playerId:p.id, agentId:p.agentId, sport:pick(sports), stake, odds, outcome, payout, createdAt:new Date(Date.now()-rand(0,45)*86400000).toISOString() });
  }
  const db = { users, agents, players, transactions, bets, settings:{ commissionBase:'GGR' } };
  fs.writeFileSync(DB_PATH, JSON.stringify(db,null,2));
}

app.post('/api/auth/login', (req,res)=>{
  const { username, password } = req.body || {};
  const db = readDB();
  const user = db.users.find(u=>u.username===username);
  if (!user) return res.status(401).json({ error:'Credenciales inválidas' });
  if (!bcrypt.compareSync(password||'', user.password)) return res.status(401).json({ error:'Credenciales inválidas' });
  const { password:_, ...profile } = user;
  res.json({ token: signToken(user), profile });
});

app.get('/api/me', authRequired, (req,res)=>{
  const db = readDB();
  const me = db.users.find(u=>u.id===req.user.id);
  if (!me) return res.status(404).json({ error:'Usuario no encontrado' });
  const { password:_, ...profile } = me;
  res.json({ profile });
});

app.get('/api/players', authRequired, (req,res)=>{
  const { q='', agentId='', page=1, perPage=20 } = req.query;
  const db = readDB();
  let rows = db.players;
  if (req.user.role==='agent') rows = rows.filter(p=> p.agentId==='ag-1' || p.agentId===req.user.id);
  if (agentId) rows = rows.filter(p=> p.agentId===agentId);
  if (q){ const s=String(q).toLowerCase(); rows = rows.filter(r=> Object.values(r).join(' ').toLowerCase().includes(s)); }
  res.json(paginate(rows, page, perPage));
});

app.post('/api/players', authRequired, (req,res)=>{
  const { name, email, phone, level='Bronce', agentId } = req.body || {};
  const db = readDB();
  const aid = req.user.role==='agent' ? (req.user.id || 'ag-1') : (agentId || 'ag-1');
  const player = { id:'pl-'+uuidv4(), agentId: aid, name, email, phone, level, balance:0, createdAt:new Date().toISOString() };
  db.players.push(player); writeDB(db);
  res.json({ player });
});

app.get('/api/transactions', authRequired, (req,res)=>{
  const { type='', status='', q='', agentId='', page=1, perPage=20 } = req.query;
  const db = readDB();
  let rows = db.transactions;
  if (req.user.role==='agent') rows = rows.filter(t=> t.agentId==='ag-1' || t.agentId===req.user.id);
  if (agentId) rows = rows.filter(t=> t.agentId===agentId);
  if (type) rows = rows.filter(t=> t.type===type);
  if (status) rows = rows.filter(t=> t.status===status);
  if (q){ const s=String(q).toLowerCase(); rows = rows.filter(r=> Object.values(r).join(' ').toLowerCase().includes(s)); }
  res.json(paginate(rows, page, perPage));
});

app.get('/api/bets', authRequired, (req,res)=>{
  const { sport='', outcome='', agentId='', page=1, perPage=20 } = req.query;
  const db = readDB();
  let rows = db.bets;
  if (req.user.role==='agent') rows = rows.filter(b=> b.agentId==='ag-1' || b.agentId===req.user.id);
  if (agentId) rows = rows.filter(b=> b.agentId===agentId);
  if (sport) rows = rows.filter(b=> b.sport===sport);
  if (outcome) rows = rows.filter(b=> b.outcome===outcome);
  res.json(paginate(rows, page, perPage));
});

app.get('/api/reports/kpi', authRequired, (req,res)=>{
  const db = readDB();
  const scopeAgent = req.user.role==='agent' ? (req.user.id || 'ag-1') : null;
  const players = db.players.filter(p=> !scopeAgent || p.agentId===scopeAgent);
  const tx = db.transactions.filter(t=> !scopeAgent || t.agentId===scopeAgent);
  const bets = db.bets.filter(b=> !scopeAgent || b.agentId===scopeAgent);
  const deposits = tx.filter(t=> t.type==='deposit' && t.status==='success').reduce((a,b)=>a+b.amount,0);
  const withdraws = tx.filter(t=> t.type==='withdraw' && t.status==='success').reduce((a,b)=>a+b.amount,0);
  const actives = new Set(bets.filter(b=> (Date.now()-new Date(b.createdAt).getTime()) < 30*86400000 ).map(b=> b.playerId)).size;
  res.json({ players:players.length, deposits:+deposits.toFixed(2), withdraws:+withdraws.toFixed(2), activePlayers30d:actives });
});

app.get('/api/reports/commission', authRequired, (req,res)=>{
  const { from='', to='', agentId='' } = req.query;
  const db = readDB();
  const start = from ? new Date(from) : new Date(Date.now()-30*86400000);
  const end = to ? new Date(to) : new Date();
  const aid = req.user.role==='agent' ? (req.user.id || 'ag-1') : (agentId || 'ag-1');
  const agent = db.agents.find(a=> a.id===aid) || { rate:0.2 };
  const bets = db.bets.filter(b=> b.agentId===aid).filter(b=> {
    const d = new Date(b.createdAt); return d>=start && d<=end;
  });
  const stakes = bets.reduce((a,b)=>a+b.stake,0);
  const payouts = bets.reduce((a,b)=>a+(b.payout||0),0);
  const ggr = stakes - payouts;
  const commission = ggr * (agent.rate || 0.2);
  res.json({ agentId:aid, base:'GGR', rate:agent.rate||0.2, from:start.toISOString(), to:end.toISOString(), stakes:+stakes.toFixed(2), payouts:+payouts.toFixed(2), ggr:+ggr.toFixed(2), commission:+commission.toFixed(2) });
});

app.get('*', (req,res)=> res.sendFile(path.join(__dirname, 'public', 'index.html')) );

const PORT = process.env.PORT || 8080;
app.listen(PORT, ()=> console.log('Agent Panel Pro on http://localhost:'+PORT) );
