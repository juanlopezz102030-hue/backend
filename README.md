# Agent Panel Pro (Demo completo)
Panel de **agentes para apuestas** con frontend + backend listos. Incluye:
- Autenticación JWT (demo: `admin/admin123`, `agent1/agent123`).
- Roles **admin** y **agent**.
- Jugadores (listado, búsqueda, alta).
- Transacciones y Apuestas con filtros.
- KPIs + **comisión por GGR** (tasa demo: 20%).

## Requisitos
- Node.js 18+

## Ejecución
```bash
cd backend
npm install
npm start
```
Abrí: **http://localhost:8080**

## Endpoints
- `POST /api/auth/login`
- `GET /api/me`
- `GET /api/players` / `POST /api/players`
- `GET /api/transactions`
- `GET /api/bets`
- `GET /api/reports/kpi`
- `GET /api/reports/commission?from=YYYY-MM-DD&to=YYYY-MM-DD&agentId=...`

> Cambiá `JWT_SECRET` en `.env` (opcional). Persistencia en `data/db.json` (demo).
