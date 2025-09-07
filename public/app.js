const API=(p,o={})=>{const t=localStorage.getItem('token');o.headers=Object.assign({'Content-Type':'application/json'},o.headers||{});if(t)o.headers['Authorization']='Bearer '+t;return fetch(p,o).then(r=>r.json())};const qs=s=>document.querySelector(s);const qsa=s=>Array.from(document.querySelectorAll(s));const fmt=n=>(typeof n==='number'?n:Number(n||0)).toLocaleString('es-AR',{minimumFractionDigits:2,maximumFractionDigits:2});
function renderLogin(){document.body.innerHTML=`
<div class="login">
  <div class="box card">
    <div class="logo"><img src="favicon.svg" width="36" height="36"/><h2>Agent Panel Pro</h2></div>
    <p style="color:var(--muted)">Ingresá con una cuenta de demo para continuar:</p>
    <form id="loginForm" class="form" style="display:grid; gap:12px; margin-top:10px">
      <input class="input" name="username" placeholder="Usuario (admin o agent1)" required />
      <input class="input" type="password" name="password" placeholder="Contraseña (admin123 o agent123)" required />
      <button class="btn" type="submit">Ingresar</button>
    </form>
    <p style="font-size:12px;color:var(--muted)">Demo: admin/admin123, agent1/agent123</p>
  </div>
</div>`;
qs('#loginForm').addEventListener('submit',async e=>{e.preventDefault();const f=new FormData(e.target);const r=await API('/api/auth/login',{method:'POST',body:JSON.stringify({username:f.get('username'),password:f.get('password')})});if(r.token){localStorage.setItem('token',r.token);localStorage.setItem('profile',JSON.stringify(r.profile));renderApp();}else alert(r.error||'Error de login');});}
function renderApp(){document.body.innerHTML=`
<div class="app">
  <aside class="sidebar">
    <button class="list-item__parent" data-route="dashboard"><span class="list-item__parent__title">Mis estadísticas</span></button>
    <div class="list-item list-item_group">
      <button class="list-item__parent" data-toggle="usuarios"><span class="list-item__parent__title">Usuarios</span><span>▾</span></button>
      <div class="list-item__children" data-group="usuarios">
        <button class="list-item__parent list-item__parent_level_1" data-route="players"><span class="list-item__parent__title">Jugadores</span></button>
        <button class="list-item__parent list-item__parent_level_1" data-route="create-player"><span class="list-item__parent__title">Crear jugador</span></button>
      </div>
    </div>
    <div class="list-item list-item_group">
      <button class="list-item__parent" data-toggle="reportes"><span class="list-item__parent__title">Reportes</span><span>▾</span></button>
      <div class="list-item__children" data-group="reportes">
        <button class="list-item__parent list-item__parent_level_1" data-route="cash"><span class="list-item__parent__title">Depósitos / Retiros</span></button>
        <button class="list-item__parent list-item__parent_level_1" data-route="bets"><span class="list-item__parent__title">Apuestas deportivas</span></button>
        <button class="list-item__parent list-item__parent_level_1" data-route="commission"><span class="list-item__parent__title">Comisiones</span></button>
      </div>
    </div>
    <button class="list-item__parent" id="logout"><span class="list-item__parent__title">Salir</span></button>
  </aside>
  <div>
    <header class="header">
      <div><b id="userName">—</b> <span style="color:var(--muted)" id="userRole"></span></div>
      <div></div>
      <div><button class="btn ghost" id="refresh">Actualizar</button></div>
    </header>
    <main class="main"><div id="view"></div></main>
  </div>
</div>`;
qs('#logout').addEventListener('click',()=>{localStorage.clear();renderLogin();});
qsa('[data-toggle]').forEach(b=>b.addEventListener('click',()=>{b.parentElement.classList.toggle('open');}));
qsa('[data-route]').forEach(b=>b.addEventListener('click',()=>navigate(b.getAttribute('data-route'))));
qs('#refresh').addEventListener('click',()=>navigate(currentRoute));
initHeader();navigate('dashboard');}
async function initHeader(){const me=JSON.parse(localStorage.getItem('profile')||'{}');qs('#userName').textContent=me.name||me.username||'—';qs('#userRole').textContent=me.role?`(${me.role})`:'';}
let currentRoute='dashboard';async function navigate(route){currentRoute=route;const v=qs('#view');v.innerHTML='';if(route==='dashboard')return renderDashboard(v);if(route==='players')return renderPlayers(v);if(route==='create-player')return renderCreatePlayer(v);if(route==='cash')return renderCash(v);if(route==='bets')return renderBets(v);if(route==='commission')return renderCommission(v);renderDashboard(v);}
async function renderDashboard(m){const k=await API('/api/reports/kpi');m.insertAdjacentHTML('beforeend',`
<div class="grid cols-3">
  <div class="card kpi"><div><div class="label">Jugadores</div><div class="value">${k.players}</div></div><div class="trend up">▲</div></div>
  <div class="card kpi"><div><div class="label">Depósitos (30d)</div><div class="value">$ ${fmt(k.deposits||0)}</div></div><div class="trend up">▲</div></div>
  <div class="card kpi"><div><div class="label">Retiros (30d)</div><div class="value">$ ${fmt(k.withdraws||0)}</div></div><div class="trend down">▼</div></div>
</div>`);m.insertAdjacentHTML('beforeend',`<div class="card"><h3>Bienvenido/a</h3><p style="color:var(--muted)">Usá el menú para navegar por reportes, jugadores y comisiones.</p></div>`);}
async function renderPlayers(m){m.insertAdjacentHTML('beforeend',`
<div class="card">
  <h3>Jugadores</h3>
  <div class="controls"><input class="input" id="q" placeholder="Buscar..." /></div>
  <div id="table"></div>
  <div id="pager" style="display:flex;gap:8px;margin-top:10px"></div>
</div>`);let page=1,perPage=15,q='';async function load(){const data=await API(`/api/players?page=${page}&perPage=${perPage}&q=${encodeURIComponent(q)}`);renderTable('#table',data.data);qs('#pager').innerHTML=`<span>Página ${data.page} de ${data.pages}</span><button class="btn ghost" ${data.page<=1?'disabled':''} id="prev">←</button><button class="btn ghost" ${data.page>=data.pages?'disabled':''} id="next">→</button>`;qs('#prev')?.addEventListener('click',()=>{page=Math.max(1,page-1);load();});qs('#next')?.addEventListener('click',()=>{page=page+1;load();});}
qs('#q').addEventListener('input',e=>{q=e.target.value;page=1;load();});await load();}
async function renderCreatePlayer(m){m.insertAdjacentHTML('beforeend',`
<div class="card">
  <h3>Crear jugador</h3>
  <form id="f" class="form" style="display:grid;gap:12px">
    <div style="display:grid;gap:10px;grid-template-columns:1fr 1fr">
      <input class="input" name="name" placeholder="Nombre Apellido" required />
      <input class="input" name="email" type="email" placeholder="email@dominio.com" required />
    </div>
    <div style="display:grid;gap:10px;grid-template-columns:1fr 1fr">
      <input class="input" name="phone" placeholder="+598 9 123 4567" required />
      <select class="select" name="level"><option>Bronce</option><option>Plata</option><option>Oro</option><option>Platino</option></select>
    </div>
    <button class="btn" type="submit">Guardar</button>
  </form>
</div>`);qs('#f').addEventListener('submit',async e=>{e.preventDefault();const f=new FormData(e.target);const r=await API('/api/players',{method:'POST',body:JSON.stringify({name:f.get('name'),email:f.get('email'),phone:f.get('phone'),level:f.get('level')})});if(r.player){alert('Jugador creado');location.hash='#players';navigate('players');}else alert(r.error||'Error al crear');});}
async function renderCash(m){m.insertAdjacentHTML('beforeend',`
<div class="card">
  <h3>Depósitos / Retiros</h3>
  <div class="controls">
    <select class="select" id="type"><option value="">Todos</option><option value="deposit">Depósito</option><option value="withdraw">Retiro</option></select>
    <select class="select" id="status"><option value="">Estado</option><option value="success">Exitoso</option><option value="pending">Pendiente</option><option value="rejected">Rechazado</option></select>
    <input class="input" id="q" placeholder="Buscar..." />
  </div>
  <div id="table"></div>
</div>`);async function load(){const t=qs('#type').value,s=qs('#status').value,q=qs('#q').value;const data=await API(`/api/transactions?type=${t}&status=${s}&q=${encodeURIComponent(q)}&perPage=50`);renderTable('#table',data.data.map(r=>({id:r.id,jugador:r.playerId,tipo:r.type,estado:r.status,monto:`$ ${fmt(r.amount)}`,fecha:r.createdAt.slice(0,10)})));}
['type','status','q'].forEach(id=>qs('#'+id).addEventListener('input',load));await load();}
async function renderBets(m){m.insertAdjacentHTML('beforeend',`
<div class="card">
  <h3>Apuestas deportivas</h3>
  <div class="controls">
    <select class="select" id="sport"><option value="">Deporte</option><option>Fútbol</option><option>Tenis</option><option>Basket</option></select>
    <select class="select" id="outcome"><option value="">Resultado</option><option value="win">Ganada</option><option value="lose">Perdida</option><option value="open">En juego</option></select>
  </div>
  <div id="table"></div>
</div>`);async function load(){const sp=qs('#sport').value,oc=qs('#outcome').value;const data=await API(`/api/bets?sport=${sp}&outcome=${oc}&perPage=50`);renderTable('#table',data.data.map(b=>({id:b.id,jugador:b.playerId,deporte:b.sport,cuota:b.odds,monto:`$ ${fmt(b.stake)}`,estado:b.outcome,pago:b.payout!=null?`$ ${fmt(b.payout)}`:'—',fecha:b.createdAt.slice(0,10)})));}
['sport','outcome'].forEach(id=>qs('#'+id).addEventListener('input',load));await load();}
async function renderCommission(m){const to=new Date();const from=new Date(Date.now()-30*86400000);const data=await API(`/api/reports/commission?from=${from.toISOString().slice(0,10)}&to=${to.toISOString().slice(0,10)}`);m.insertAdjacentHTML('beforeend',`
<div class="card">
  <h3>Comisiones</h3>
  <p style="color:var(--muted)">Base: ${data.base}, Tasa: ${(data.rate*100).toFixed(1)}%</p>
  <div class="grid cols-2">
    <div class="card"><b>Stakes:</b> $ ${fmt(data.stakes)}</div>
    <div class="card"><b>Payouts:</b> $ ${fmt(data.payouts)}</div>
  </div>
  <div class="grid cols-2" style="margin-top:10px">
    <div class="card"><b>GGR:</b> $ ${fmt(data.ggr)}</div>
    <div class="card"><b>Comisión:</b> $ ${fmt(data.commission)}</div>
  </div>
</div>`);}
function renderTable(sel, rows){const m=qs(sel);if(!rows||!rows.length){m.innerHTML='<p style="color:var(--muted)">Sin datos</p>';return;}const cols=Object.keys(rows[0]);const thead=`<thead><tr>${cols.map(c=>`<th>${c}</th>`).join('')}</tr></thead>`;const tbody=`<tbody>${rows.map(r=>`<tr>${cols.map(c=>`<td>${r[c]}</td>`).join('')}</tr>`).join('')}</tbody>`;m.innerHTML=`<table class="table">${thead}${tbody}</table>`;}
(async function(){const t=localStorage.getItem('token');if(!t)return renderLogin();try{const me=await API('/api/me');if(me&&me.profile){renderApp();}else{localStorage.clear();renderLogin();}}catch(e){localStorage.clear();renderLogin();}})();
