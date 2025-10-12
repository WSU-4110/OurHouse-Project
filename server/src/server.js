// server/src/server.js
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const { Parser } = require('json2csv');
require('dotenv').config();

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
  database: process.env.PGDATABASE || 'warehouse',
  ssl: (/require/i).test(process.env.PGSSLMODE || '') ? { rejectUnauthorized: false } : false,
});

// quick health check on startup
(async () => {
  try {
    const { rows } = await pool.query('select now() as now');
    console.log('✅ DB connected at', rows[0].now);
  } catch (err) {
    console.error('❌ Could not connect to Postgres. Check server/.env values.', err.message);
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

// receive
app.post('/transactions/receive', handle(async (req, res) => {
  const { productId, binId, qty, reference, user } = req.body;
  if (!productId || !binId || !qty || qty <= 0) {
    return res.status(400).json({ error: 'productId, binId, positive qty required' });
  }
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query(
      `insert into stock_levels(product_id, bin_id, qty)
       values ($1,$2,$3)
       on conflict (product_id,bin_id) do update set qty=stock_levels.qty+excluded.qty`,
      [productId, binId, qty]
    );
    await client.query(
      `insert into stock_transactions(type, product_id, to_bin_id, qty, reference, performed_by)
       values ('IN',$1,$2,$3,$4,$5)`,
      [productId, binId, qty, reference || null, user || 'api']
    );
    await client.query('commit');
    res.json({ ok: true });
  } catch (e) {
    await client.query('rollback');
    throw e;
  } finally {
    client.release();
  }
}));

// ship
app.post('/transactions/ship', handle(async (req, res) => {
  const { productId, binId, qty, reference, user } = req.body;
  if (!productId || !binId || !qty || qty <= 0) {
    return res.status(400).json({ error: 'productId, binId, positive qty required' });
  }
  const client = await pool.connect();
  try {
    await client.query('begin');
    const available = await getQty(client, productId, binId);
    if (available < qty) {
      await client.query('rollback');
      return res.status(400).json({ error: `Only ${available} available` });
    }
    await client.query(
      `update stock_levels set qty = qty - $3
       where product_id=$1 and bin_id=$2`,
      [productId, binId, qty]
    );
    await client.query(
      `insert into stock_transactions(type, product_id, from_bin_id, qty, reference, performed_by)
       values ('OUT',$1,$2,$3,$4,$5)`,
      [productId, binId, qty, reference || null, user || 'api']
    );
    await client.query('commit');
    res.json({ ok: true });
  } catch (e) {
    await client.query('rollback');
    throw e;
  } finally {
    client.release();
  }
}));

// transfer
app.post('/transactions/transfer', handle(async (req, res) => {
  const { productId, fromBinId, toBinId, qty, reference, user } = req.body;
  if (!productId || !fromBinId || !toBinId || fromBinId === toBinId || !qty || qty <= 0) {
    return res.status(400).json({ error: 'productId, fromBinId!=toBinId, positive qty required' });
  }
  const client = await pool.connect();
  try {
    await client.query('begin');
    const available = await getQty(client, productId, fromBinId);
    if (available < qty) {
      await client.query('rollback');
      return res.status(400).json({ error: `Only ${available} available in source bin` });
    }
    await client.query(
      `update stock_levels set qty = qty - $3
       where product_id=$1 and bin_id=$2`,
      [productId, fromBinId, qty]
    );
    await client.query(
      `insert into stock_levels(product_id, bin_id, qty)
       values ($1,$2,$3)
       on conflict (product_id,bin_id) do update set qty=stock_levels.qty+excluded.qty`,
      [productId, toBinId, qty]
    );
    await client.query(
      `insert into stock_transactions(type, product_id, from_bin_id, to_bin_id, qty, reference, performed_by)
       values ('MOVE',$1,$2,$3,$4,$5,$6)`,
      [productId, fromBinId, toBinId, qty, reference || null, user || 'api']
    );
    await client.query('commit');
    res.json({ ok: true });
  } catch (e) {
    await client.query('rollback');
    throw e;
  } finally {
    client.release();
  }
}));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`API listening on http://localhost:${port}`));


// EXPORT TO CSV
// Temporary middleware until we have real auth
function requireInventoryManager(req, res, next) {
    // For now, allow all requests through
    // Later replace with: if (req.user?.role === "InventoryManager") { ... }
    return next();
}

app.get("/export/csv", requireInventoryManager, async (req, res) => {
    try {
        const result = await pool.query(`
      SELECT 
        l.name AS location,
        p.name AS product,
        b.code AS bin,
        s.qty AS quantity
      FROM stock_levels s
      JOIN products p ON s.product_id = p.id
      JOIN bins b ON s.bin_id = b.id
      JOIN locations l ON b.location_id = l.id
      ORDER BY l.name, p.name, b.code
    `);

        const parser = new Parser();
        const csv = parser.parse(result.rows);

        res.header("Content-Type", "text/csv");
        res.attachment("inventory.csv");
        return res.send(csv);
    } catch (err) {
        console.error("CSV export failed:", err.message);
        console.error(err.stack);
        res.status(500).json({ error: "Failed to export CSV" });
    }
});








