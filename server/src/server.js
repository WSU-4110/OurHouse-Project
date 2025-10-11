// server/src/server.js
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config();

const { MovementService } = require('./services/MovementService');
const { ReceiveCommand }  = require('./commands/ReceiveCommand');
const { ShipCommand }     = require('./commands/ShipCommand');
const { TransferCommand } = require('./commands/TransferCommand');

const app = express();
app.use(express.json());

const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';
app.use(cors({ origin: corsOrigin, credentials: true }));

// Build a safe config (no connection string parsing)
const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: Number(process.env.PGPORT || 5432),
  user: process.env.PGUSER || 'postgres',
  password: String(process.env.PGPASSWORD ?? ''),
  database: process.env.PGDATABASE || 'OurHouse',
  ssl: (/require/i).test(process.env.PGSSLMODE || '') ? { rejectUnauthorized: false } : false,
});

// quick health check on startup
(async () => {
  try {
    const { rows } = await pool.query('select now() as now');
    console.log('DB connected at', rows[0].now);
  } catch (err) {
    console.error('Could not connect to Postgres. Check server/.env values.', err.message);
    console.error('   PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE must be correct.');
  }
})();

// tiny helper to avoid repeating try/catch
const handle = (fn) => (req, res) => fn(req, res).catch(err => {
  console.error(err);
  res.status(500).json({ error: err.message });
});

app.get('/ok', (req, res) => res.json({ ok: true }));

// products
app.get('/products', handle(async (req, res) => {
  const { rows } = await pool.query(
    'select id, sku, name, description, unit, created_at from products order by id'
  );
  res.json(rows);
}));

// locations + bins
app.get('/locations', handle(async (req, res) => {
  const { rows } = await pool.query('select id, name from locations order by id');
  res.json(rows);
}));

app.get('/locations/:id/bins', handle(async (req, res) => {
  const { id } = req.params;
  const { rows } = await pool.query(
    'select id, location_id, code from bins where location_id=$1 order by code',
    [id]
  );
  res.json(rows);
}));

// current stock
app.get('/stock', handle(async (req, res) => {
  const { rows } = await pool.query('select * from v_stock');
  res.json(rows);
}));

// helpers
async function getQty(client, productId, binId) {
  const { rows } = await client.query(
    'select qty from stock_levels where product_id=$1 and bin_id=$2',
    [productId, binId]
  );
  return rows[0]?.qty ? Number(rows[0].qty) : 0;
}

const svc = new MovementService(); // uses InventoryRepository internally

app.post('/transactions/receive', handle(async (req, res) => {
  // expected body: { productId, binId, qty, reference?, user? }
  const result = await svc.run(new ReceiveCommand(req.body));
  res.json(result); // { ok: true }
}));

app.post('/transactions/ship', handle(async (req, res) => {
  // expected body: { productId, binId, qty, reference?, user? }
  const result = await svc.run(new ShipCommand(req.body));
  res.json(result);
}));

app.post('/transactions/transfer', handle(async (req, res) => {
  // expected body: { productId, fromBinId, toBinId, qty, reference?, user? }
  const result = await svc.run(new TransferCommand(req.body));
  res.json(result);
}));

const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});