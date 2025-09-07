// app.js
// Maneja la lógica del panel de agentes: autenticación, navegación y carga de datos.

document.addEventListener('DOMContentLoaded', () => {
  const loginScreen = document.getElementById('login-screen');
  const loginForm = document.getElementById('login-form');
  const loginError = document.getElementById('login-error');
  const app = document.getElementById('app');
  const userRoleEl = document.getElementById('user-role');
  const userNameEl = document.getElementById('user-name');
  const logoutButton = document.getElementById('logout-button');
  const contentEl = document.getElementById('content');
  const navItems = document.querySelectorAll('.nav-item');

  let token = localStorage.getItem('token');
  let currentUser = null;

  // Attempt to restore session if token exists
  if (token) {
    // We don't verify the token client-side, just fetch user info from storage
    const userData = localStorage.getItem('user');
    if (userData) {
      currentUser = JSON.parse(userData);
      showApp();
    }
  }

  // Handle login form submission
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error de autenticación');
      }
      const data = await res.json();
      token = data.token;
      currentUser = data.user;
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(currentUser));
      loginError.textContent = '';
      showApp();
    } catch (err) {
      loginError.textContent = err.message;
    }
  });

  // Logout handler
  logoutButton.addEventListener('click', () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    token = null;
    currentUser = null;
    app.classList.add('hidden');
    loginScreen.classList.remove('hidden');
  });

  // Set up navigation clicks
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      navItems.forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      const section = item.getAttribute('data-section');
      loadSection(section);
    });
  });

  /**
   * Shows the main application after successful login.
   */
  function showApp() {
    loginScreen.classList.add('hidden');
    app.classList.remove('hidden');
    userRoleEl.textContent = currentUser.role === 'admin' ? 'Administrador' : 'Agente';
    userNameEl.textContent = currentUser.name;
    // Load default section
    setActiveNav('dashboard');
    loadSection('dashboard');
  }

  /**
   * Mark navigation item as active based on section name.
   * @param {string} section
   */
  function setActiveNav(section) {
    navItems.forEach(i => {
      if (i.getAttribute('data-section') === section) {
        i.classList.add('active');
      } else {
        i.classList.remove('active');
      }
    });
  }

  /**
   * Load the requested section. Dispatch to appropriate loader.
   * @param {string} section
   */
  function loadSection(section) {
    switch (section) {
      case 'dashboard':
        loadDashboard();
        break;
      case 'players':
        loadPlayers();
        break;
      case 'transactions':
        loadTransactions();
        break;
      case 'bets':
        loadBets();
        break;
      case 'commissions':
        loadCommissions();
        break;
      default:
        contentEl.innerHTML = '';
        break;
    }
  }

  /**
   * Helper to perform authenticated GET requests.
   * @param {string} url
   */
  async function authGet(url) {
    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    if (!res.ok) {
      if (res.status === 401) {
        // session expired, log out
        logoutButton.click();
        throw new Error('Sesión expirada');
      }
      const err = await res.json();
      throw new Error(err.error || 'Error al cargar datos');
    }
    return res.json();
  }

  /**
   * Load dashboard metrics and render them.
   */
  async function loadDashboard() {
    contentEl.innerHTML = '<p>Cargando dashboard…</p>';
    try {
      const summary = await authGet('/api/summary');
      // Build cards with summary values
      const cardsHtml = `
        <div class="card">
          <h3>Jugadores</h3>
          <p>${summary.playersCount}</p>
        </div>
        <div class="card">
          <h3>Stake total</h3>
          <p>$${summary.totalStake.toLocaleString('es-UY')}</p>
        </div>
        <div class="card">
          <h3>GGR</h3>
          <p>$${summary.ggr.toLocaleString('es-UY')}</p>
        </div>
        <div class="card">
          <h3>Comisión</h3>
          <p>$${summary.commission !== null ? summary.commission.toLocaleString('es-UY') : '–'}</p>
        </div>
      `;
      contentEl.innerHTML = `<div class="cards-grid">${cardsHtml}</div>`;
      // Additional explanatory text
      contentEl.innerHTML += `
        <div class="card">
          <h3>Bienvenido, ${currentUser.name}</h3>
          <p>Este dashboard muestra un resumen general de tu actividad. Usa el menú de la izquierda para navegar entre jugadores, transacciones, apuestas y comisiones.</p>
        </div>
      `;
    } catch (err) {
      contentEl.innerHTML = `<p class="error-message">${err.message}</p>`;
    }
  }

  /**
   * Load and render list of players with search and pagination.
   */
  async function loadPlayers() {
    contentEl.innerHTML = '<p>Cargando jugadores…</p>';
    try {
      const players = await authGet('/api/players');
      // Set up pagination variables
      let currentPage = 1;
      const pageSize = 10;
      let filtered = [...players];

      function render() {
        const start = (currentPage - 1) * pageSize;
        const end = start + pageSize;
        const pageItems = filtered.slice(start, end);
        let html = `
          <div class="card">
            <h3>Jugadores (${players.length})</h3>
            <div class="search-bar">
              <input type="text" id="player-search" placeholder="Buscar por nombre o email…" />
            </div>
            <table class="table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Email</th>
                  <th>Teléfono</th>
                  <th>Nivel</th>
                  <th>Balance</th>
                </tr>
              </thead>
              <tbody>
                ${pageItems.map(p => `
                  <tr>
                    <td>${p.name}</td>
                    <td>${p.email}</td>
                    <td>${p.phone}</td>
                    <td>${p.level}</td>
                    <td>$${p.balance.toFixed(2)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            <div class="pagination">
              <button id="prev-page">Anterior</button>
              <span>Página ${currentPage} de ${Math.ceil(filtered.length / pageSize)}</span>
              <button id="next-page">Siguiente</button>
            </div>
          </div>
        `;
        contentEl.innerHTML = html;
        // After injecting HTML, add event listeners
        document.getElementById('player-search').addEventListener('input', (e) => {
          const term = e.target.value.toLowerCase();
          filtered = players.filter(p =>
            p.name.toLowerCase().includes(term) ||
            p.email.toLowerCase().includes(term)
          );
          currentPage = 1;
          render();
        });
        const prevBtn = document.getElementById('prev-page');
        const nextBtn = document.getElementById('next-page');
        prevBtn.disabled = currentPage === 1;
        nextBtn.disabled = currentPage >= Math.ceil(filtered.length / pageSize);
        prevBtn.addEventListener('click', () => {
          if (currentPage > 1) {
            currentPage--;
            render();
          }
        });
        nextBtn.addEventListener('click', () => {
          if (currentPage < Math.ceil(filtered.length / pageSize)) {
            currentPage++;
            render();
          }
        });
      }
      render();
    } catch (err) {
      contentEl.innerHTML = `<p class="error-message">${err.message}</p>`;
    }
  }

  /**
   * Load and render list of transactions with status.
   */
  async function loadTransactions() {
    contentEl.innerHTML = '<p>Cargando transacciones…</p>';
    try {
      const txs = await authGet('/api/transactions');
      // Sort by date descending
      txs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      const html = `
        <div class="card">
          <h3>Transacciones (${txs.length})</h3>
          <table class="table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Jugador</th>
                <th>Tipo</th>
                <th>Monto</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              ${txs.map(tx => `
                <tr>
                  <td>${new Date(tx.createdAt).toLocaleDateString('es-UY')}</td>
                  <td>${findPlayerName(tx.playerId)}</td>
                  <td>${tx.type === 'deposit' ? 'Depósito' : 'Retiro'}</td>
                  <td>$${tx.amount.toFixed(2)}</td>
                  <td>${formatStatus(tx.status)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
      contentEl.innerHTML = html;
    } catch (err) {
      contentEl.innerHTML = `<p class="error-message">${err.message}</p>`;
    }
  }

  /**
   * Load and render list of bets.
   */
  async function loadBets() {
    contentEl.innerHTML = '<p>Cargando apuestas…</p>';
    try {
      const bets = await authGet('/api/bets');
      bets.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      const html = `
        <div class="card">
          <h3>Apuestas (${bets.length})</h3>
          <table class="table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Jugador</th>
                <th>Deporte</th>
                <th>Stake</th>
                <th>Cuota</th>
                <th>Resultado</th>
                <th>Ganancia</th>
              </tr>
            </thead>
            <tbody>
              ${bets.map(b => `
                <tr>
                  <td>${new Date(b.createdAt).toLocaleDateString('es-UY')}</td>
                  <td>${findPlayerName(b.playerId)}</td>
                  <td>${b.sport}</td>
                  <td>$${b.stake.toFixed(2)}</td>
                  <td>${b.odds.toFixed(2)}</td>
                  <td>${formatOutcome(b.outcome)}</td>
                  <td>${b.payout !== null ? '$' + b.payout.toFixed(2) : '—'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
      contentEl.innerHTML = html;
    } catch (err) {
      contentEl.innerHTML = `<p class="error-message">${err.message}</p>`;
    }
  }

  /**
   * Compute and show commissions. For an agent this is just the commission value;
   * for an admin it shows a breakdown per agente.
   */
  async function loadCommissions() {
    contentEl.innerHTML = '<p>Cargando comisiones…</p>';
    try {
      const summary = await authGet('/api/summary');
      if (currentUser.role === 'agent') {
        const html = `
          <div class="card">
            <h3>Comisión acumulada</h3>
            <p class="highlight">$${summary.commission.toLocaleString('es-UY')}</p>
            <p>Tu comisión se calcula como un porcentaje del GGR generado por tus jugadores.</p>
          </div>
        `;
        contentEl.innerHTML = html;
      } else {
        // Admin: compute breakdown by agent
        const dbData = await Promise.all([
          authGet('/api/players'),
          authGet('/api/bets')
        ]);
        const players = dbData[0];
        const bets = dbData[1];
        // Build a map of agentId -> { name, rate }
        const agentMap = {};
        // Fetch agents info from summary? we don't have endpoint; we'll use players list
        players.forEach(p => {
          if (!agentMap[p.agentId]) {
            agentMap[p.agentId] = { name: '', rate: 0, ggr: 0, commission: 0 };
          }
        });
        // We need to fetch agent names from /api/summary? Instead derive from players or from localStorage user? We'll just show IDs if missing.
        // Compute ggr per agent
        Object.keys(agentMap).forEach(aid => {
          const agentBets = bets.filter(b => b.agentId === aid);
          let stakeSum = 0;
          let payoutSum = 0;
          agentBets.forEach(b => {
            stakeSum += b.stake;
            if (b.payout !== null) payoutSum += b.payout;
          });
          const ggrAgent = stakeSum - payoutSum;
          // For demo, assume rate 20%
          const rate = 0.2;
          agentMap[aid].ggr = ggrAgent;
          agentMap[aid].rate = rate;
          agentMap[aid].commission = ggrAgent * rate;
          // find player with this agent to get name (hack)
          const anyPlayer = players.find(p => p.agentId === aid);
          agentMap[aid].name = anyPlayer ? anyPlayer.agentId : aid;
        });
        const rows = Object.entries(agentMap).map(([aid, data]) => `
          <tr>
            <td>${aid}</td>
            <td>$${data.ggr.toFixed(2)}</td>
            <td>${(data.rate * 100).toFixed(0)}%</td>
            <td>$${data.commission.toFixed(2)}</td>
          </tr>
        `).join('');
        const html = `
          <div class="card">
            <h3>Comisiones por agente</h3>
            <table class="table">
              <thead>
                <tr>
                  <th>Agente</th>
                  <th>GGR</th>
                  <th>Tasa</th>
                  <th>Comisión</th>
                </tr>
              </thead>
              <tbody>
                ${rows}
              </tbody>
            </table>
          </div>
        `;
        contentEl.innerHTML = html;
      }
    } catch (err) {
      contentEl.innerHTML = `<p class="error-message">${err.message}</p>`;
    }
  }

  /**
   * Helper: find a player's name by id from cached players data.
   * For simplicity we lazily cache the players list on first call.
   */
  let playersCache = null;
  function findPlayerName(id) {
    if (!playersCache) return id;
    const p = playersCache.find(pl => pl.id === id);
    return p ? p.name : id;
  }
  // We'll update playersCache whenever we load players or transactions/bets
  async function updatePlayersCache() {
    try {
      playersCache = await authGet('/api/players');
    } catch {
      playersCache = [];
    }
  }
  // On initial load update players cache asynchronously
  if (token) {
    updatePlayersCache();
  }

  /**
   * Helper functions to translate status and outcomes
   */
  function formatStatus(status) {
    switch (status) {
      case 'success': return 'Éxito';
      case 'pending': return 'Pendiente';
      case 'rejected': return 'Rechazado';
      default: return status;
    }
  }
  function formatOutcome(outcome) {
    switch (outcome) {
      case 'win': return 'Ganó';
      case 'lose': return 'Perdió';
      case 'open': return 'Abierta';
      default: return outcome;
    }
  }
});