// server/src/server.js
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const { Parser } = require('json2csv');
require('dotenv').config();

// Force authentication bypass in test mode (set BEFORE routes are imported)
if (process.env.NODE_ENV === 'test') {
  process.env.BYPASS_AUTH = 'true';
  console.log('Auth bypass enabled for Jest tests');
}

// ✅ Correct middleware import (test-bypass aware)
const { requireAuth: authRequired, requireRole: roleRequired } = require('./auth/requireAuth');

const authRoutes = require('./routes/authRoutes');
const importRoutes = require('./routes/importRoutes');
const exportRoutes = require('./routes/exportRoutes');
const stockRoutes = require('./routes/stockRoutes');
const { idempotencyMiddleware } = require('./middleware/Idempotencymiddleware');
const { initializeScheduler } = require('./services/scheduler');
const { sendTestDigest } = require('./services/emailService');

const app = express();
const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';

app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(express.json());
app.use('/auth', authRoutes);
app.use('/import', importRoutes);
app.use('/export', exportRoutes);
app.use('/stock', stockRoutes);

const scheduledJobs = initializeScheduler();

const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: Number(process.env.PGPORT || 5432),
  user: process.env.PGUSER || 'postgres',
  password: String(process.env.PGPASSWORD ?? ''),
  database: process.env.PGDATABASE || 'OurHouse',
  ssl: (/require/i).test(process.env.PGSSLMODE || '')
    ? { rejectUnauthorized: false }
    : false,
});

// quick health check on startup
(async () => {
  try {
    const { rows } = await pool.query('select now() as now');
    console.log('✅ DB connected at', rows[0].now);
  } catch (err) {
    console.error(
      '❌ Could not connect to Postgres. Check server/.env values.',
      err.message
    );
    console.error(
      '   PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE must be correct.'
    );
  }
})();

// tiny helper to avoid repeating try/catch
const handle = (fn) => (req, res) =>
  fn(req, res).catch((err) => {
    console.error(err);
    res.status(500).json({ error: err.message });
  });

app.get('/ok', (req, res) => res.json({ ok: true }));

// ============================================
// PRODUCTS ENDPOINTS
// ============================================

// GET all products (include min_qty and lead_time_days)
app.get(
  '/products',
  handle(async (req, res) => {
    const { rows } = await pool.query(
      `SELECT id, sku, name, description, unit, min_qty, lead_time_days, created_at 
       FROM products 
       ORDER BY id`
    );
    res.json(rows);
  })
);

// POST create new product
app.post(
  '/admin/products',
  authRequired,
  roleRequired('Manager', 'Admin'),
  handle(async (req, res) => {
    const { sku, name, description, unit, min_qty, lead_time_days } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Product name is required' });
    }

    const { rows } = await pool.query(
      `INSERT INTO products(sku, name, description, unit, min_qty, lead_time_days)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, sku, name, description, unit, min_qty, lead_time_days`,
      [
        sku || null,
        name,
        description || '',
        unit || 'each',
        min_qty !== undefined ? Number(min_qty) : 10,
        lead_time_days !== undefined ? Number(lead_time_days) : 0,
      ]
    );

    // Log the action
    await pool.query(
      `INSERT INTO activity_logs(action_type, user_name, user_role, details)
       VALUES ($1, $2, $3, $4)`,
      ['ADD_PRODUCT', req.user.name, req.user.role, JSON.stringify(rows[0])]
    );

    res.json(rows[0]);
  })
);

// PATCH update existing product
app.patch(
  '/admin/products/:id',
  authRequired,
  roleRequired('Manager', 'Admin'),
  handle(async (req, res) => {
    const { id } = req.params;
    const { sku, name, description, unit, min_qty, lead_time_days } = req.body;

    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (sku !== undefined) {
      updates.push(`sku = $${paramIndex++}`);
      values.push(sku);
    }
    if (name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(name);
    }
    if (description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(description);
    }
    if (unit !== undefined) {
      updates.push(`unit = $${paramIndex++}`);
      values.push(unit);
    }
    if (min_qty !== undefined) {
      updates.push(`min_qty = $${paramIndex++}`);
      values.push(Number(min_qty));
    }
    if (lead_time_days !== undefined) {
      updates.push(`lead_time_days = $${paramIndex++}`);
      values.push(Number(lead_time_days));
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(id);
    const { rows } = await pool.query(
      `UPDATE products SET ${updates.join(', ')} 
       WHERE id = $${paramIndex}
       RETURNING id, sku, name, description, unit, min_qty, lead_time_days`,
      values
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json(rows[0]);
  })
);

// DELETE product
app.delete(
  '/admin/products/:id',
  authRequired,
  roleRequired('Manager', 'Admin'),
  handle(async (req, res) => {
    const { id } = req.params;
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const { rows: product } = await client.query(
        'SELECT * FROM products WHERE id = $1',
        [id]
      );
      if (product.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Product not found' });
      }

      // Delete related stock levels first
      await client.query('DELETE FROM stock_levels WHERE product_id = $1', [
        id,
      ]);

      // Delete the product
      await client.query('DELETE FROM products WHERE id = $1', [id]);

      // Log the action
      await client.query(
        `INSERT INTO activity_logs(action_type, user_name, user_role, details)
         VALUES ($1, $2, $3, $4)`,
        [
          'DELETE_PRODUCT',
          req.user.name,
          req.user.role,
          JSON.stringify(product[0]),
        ]
      );

      await client.query('COMMIT');
      res.json({ ok: true, message: 'Product deleted successfully' });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  })
);

// ============================================
// LOCATIONS ENDPOINTS
// ============================================

// GET all locations
app.get(
  '/locations',
  handle(async (req, res) => {
    const { rows } = await pool.query(
      'SELECT id, name FROM locations ORDER BY id'
    );
    res.json(rows);
  })
);

// POST create new location
app.post(
  '/admin/locations',
  authRequired,
  roleRequired('Manager', 'Admin'),
  handle(async (req, res) => {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Location name is required' });
    }

    const { rows } = await pool.query(
      'INSERT INTO locations(name) VALUES ($1) RETURNING id, name',
      [name]
    );

    // Log the action
    await pool.query(
      `INSERT INTO activity_logs(action_type, user_name, user_role, details)
       VALUES ($1, $2, $3, $4)`,
      ['ADD_LOCATION', req.user.name, req.user.role, JSON.stringify(rows[0])]
    );

    res.json(rows[0]);
  })
);

// DELETE location
app.delete(
  '/admin/locations/:id',
  authRequired,
  roleRequired('Manager', 'Admin'),
  handle(async (req, res) => {
    const { id } = req.params;
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Check if location has stock
      const { rows: stockCheck } = await client.query(
        `SELECT COUNT(*) as count FROM stock_levels sl
         JOIN bins b ON sl.bin_id = b.id
         WHERE b.location_id = $1 AND sl.qty > 0`,
        [id]
      );

      if (Number(stockCheck[0].count) > 0) {
        await client.query('ROLLBACK');
        return res
          .status(400)
          .json({ error: 'Cannot delete location with stock in bins' });
      }

      const { rows: location } = await client.query(
        'SELECT * FROM locations WHERE id = $1',
        [id]
      );

      // Delete empty stock levels, bins, then location
      await client.query(
        'DELETE FROM stock_levels WHERE bin_id IN (SELECT id FROM bins WHERE location_id = $1)',
        [id]
      );
      await client.query('DELETE FROM bins WHERE location_id = $1', [id]);
      await client.query('DELETE FROM locations WHERE id = $1', [id]);

      // Log the action
      await client.query(
        `INSERT INTO activity_logs(action_type, user_name, user_role, details)
         VALUES ($1, $2, $3, $4)`,
        [
          'DELETE_LOCATION',
          req.user.name,
          req.user.role,
          JSON.stringify(location[0]),
        ]
      );

      await client.query('COMMIT');
      res.json({ ok: true, message: 'Location deleted successfully' });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  })
);

// ============================================
// BINS ENDPOINTS
// ============================================

// GET bins for a location
app.get(
  '/locations/:id/bins',
  handle(async (req, res) => {
    const { id } = req.params;
    const { rows } = await pool.query(
      'SELECT id, location_id, code FROM bins WHERE location_id=$1 ORDER BY code',
      [id]
    );
    res.json(rows);
  })
);

// POST create new bin
app.post(
  '/admin/bins',
  authRequired,
  roleRequired('Manager', 'Admin'),
  handle(async (req, res) => {
    const { locationId, code } = req.body;

    if (!locationId || !code) {
      return res
        .status(400)
        .json({ error: 'Location ID and bin code are required' });
    }

    // Check for duplicate bin code in the same location
    const { rows: existing } = await pool.query(
      'SELECT id FROM bins WHERE location_id = $1 AND LOWER(code) = LOWER($2)',
      [locationId, code]
    );

    if (existing.length > 0) {
      return res
        .status(409)
        .json({ error: 'Bin code already exists in this location' });
    }

    const { rows } = await pool.query(
      'INSERT INTO bins(location_id, code) VALUES ($1, $2) RETURNING id, location_id, code',
      [locationId, code.toUpperCase()] // Store bin codes in uppercase for consistency
    );

    // Log the action
    await pool.query(
      `INSERT INTO activity_logs(action_type, user_name, user_role, details)
       VALUES ($1, $2, $3, $4)`,
      ['ADD_BIN', req.user.name, req.user.role, JSON.stringify(rows[0])]
    );

    res.json(rows[0]);
  })
);

// DELETE bin
app.delete(
  '/admin/bins/:id',
  authRequired,
  roleRequired('Manager', 'Admin'),
  handle(async (req, res) => {
    const { id } = req.params;
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Check if bin has stock
      const { rows: stockCheck } = await client.query(
        'SELECT COUNT(*) as count FROM stock_levels WHERE bin_id = $1 AND qty > 0',
        [id]
      );

      if (Number(stockCheck[0].count) > 0) {
        await client.query('ROLLBACK');
        return res
          .status(400)
          .json({ error: 'Cannot delete bin with existing stock' });
      }

      const { rows: bin } = await client.query(
        'SELECT b.*, l.name as location_name FROM bins b JOIN locations l ON b.location_id = l.id WHERE b.id = $1',
        [id]
      );

      // Delete empty stock levels then bin
      await client.query('DELETE FROM stock_levels WHERE bin_id = $1', [id]);
      await client.query('DELETE FROM bins WHERE id = $1', [id]);

      // Log the action
      await client.query(
        `INSERT INTO activity_logs(action_type, user_name, user_role, details)
         VALUES ($1, $2, $3, $4)`,
        [
          'DELETE_BIN',
          req.user.name,
          req.user.role,
          JSON.stringify(bin[0]),
        ]
      );

      await client.query('COMMIT');
      res.json({ ok: true, message: 'Bin deleted successfully' });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  })
);

// ============================================
// STOCK ENDPOINTS
// ============================================

// GET current stock
app.get(
  '/stock',
  handle(async (req, res) => {
    const { rows } = await pool.query('SELECT * FROM v_stock');
    res.json(rows);
  })
);

// DELETE stock from specific bin
app.delete(
  '/admin/stock/:productId/:binId',
  authRequired,
  roleRequired('Manager', 'Admin'),
  handle(async (req, res) => {
    const { productId, binId } = req.params;
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const { rows: stockInfo } = await client.query(
        `SELECT sl.qty, p.sku, p.name, b.code as bin_code, l.name as location_name
         FROM stock_levels sl
         JOIN products p ON sl.product_id = p.id
         JOIN bins b ON sl.bin_id = b.id
         JOIN locations l ON b.location_id = l.id
         WHERE sl.product_id = $1 AND sl.bin_id = $2`,
        [productId, binId]
      );

      if (stockInfo.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Stock not found' });
      }

      await client.query(
        'DELETE FROM stock_levels WHERE product_id = $1 AND bin_id = $2',
        [productId, binId]
      );

      await client.query(
        `INSERT INTO activity_logs(action_type, user_name, user_role, details)
         VALUES ($1, $2, $3, $4)`,
        [
          'DELETE_STOCK',
          req.user.name,
          req.user.role,
          JSON.stringify({
            productId,
            binId,
            sku: stockInfo[0].sku,
            productName: stockInfo[0].name,
            binCode: stockInfo[0].bin_code,
            locationName: stockInfo[0].location_name,
            qty: stockInfo[0].qty,
          }),
        ]
      );

      await client.query('COMMIT');
      res.json({ ok: true, message: 'Stock deleted from bin successfully' });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  })
);

// Check available stock in a specific bin
app.get(
  '/stock/check/:productId/:binId',
  authRequired,
  handle(async (req, res) => {
    const { productId, binId } = req.params;
    const { rows } = await pool.query(
      'SELECT qty FROM stock_levels WHERE product_id = $1 AND bin_id = $2',
      [productId, binId]
    );
    res.json({ qty: rows[0]?.qty || 0 });
  })
);

// ============================================
// TRANSACTION ENDPOINTS
// ============================================

// Helper to get quantity
async function getQty(client, productId, binId) {
  const { rows } = await client.query(
    'SELECT qty FROM stock_levels WHERE product_id=$1 AND bin_id=$2',
    [productId, binId]
  );
  return rows[0]?.qty ? Number(rows[0].qty) : 0;
}

// RECEIVE stock
app.post(
  '/transactions/receive',
  authRequired,
  roleRequired('Worker', 'Manager', 'Admin'),
  idempotencyMiddleware,
  handle(async (req, res) => {
    const { productId, binId, qty, reference, user } = req.body;
    if (!productId || !binId || !qty || qty <= 0) {
      return res
        .status(400)
        .json({ error: 'productId, binId, positive qty required' });
    }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Update or insert stock level
      await client.query(
        `INSERT INTO stock_levels(product_id, bin_id, qty)
         VALUES ($1,$2,$3)
         ON CONFLICT (product_id,bin_id) DO UPDATE SET qty=stock_levels.qty+excluded.qty`,
        [productId, binId, qty]
      );

      // Record transaction
      await client.query(
        `INSERT INTO stock_transactions(type, product_id, to_bin_id, qty, reference, performed_by)
         VALUES ('IN',$1,$2,$3,$4,$5)`,
        [productId, binId, qty, reference || null, user || 'api']
      );

      // Log activity
      await client.query(
        `INSERT INTO activity_logs(action_type, user_name, user_role, details)
         VALUES ($1, $2, $3, $4)`,
        [
          'RECEIVE',
          user,
          req.user.role,
          JSON.stringify({ productId, binId, qty, reference }),
        ]
      );

      await client.query('COMMIT');
      res.json({ ok: true });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  })
);

// SHIP stock
app.post(
  '/transactions/ship',
  authRequired,
  roleRequired('Worker', 'Manager', 'Admin'),
  idempotencyMiddleware,
  handle(async (req, res) => {
    const { productId, binId, qty, reference, user } = req.body;
    if (!productId || !binId || !qty || qty <= 0) {
      return res
        .status(400)
        .json({ error: 'productId, binId, positive qty required' });
    }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Check available quantity
      const available = await getQty(client, productId, binId);
      if (available < qty) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Only ${available} available` });
      }

      // Decrease stock level
      await client.query(
        `UPDATE stock_levels SET qty = qty - $3
         WHERE product_id=$1 AND bin_id=$2`,
        [productId, binId, qty]
      );

      // Record transaction
      await client.query(
        `INSERT INTO stock_transactions(type, product_id, from_bin_id, qty, reference, performed_by)
         VALUES ('OUT',$1,$2,$3,$4,$5)`,
        [productId, binId, qty, reference || null, user || 'api']
      );

      // Log activity
      await client.query(
        `INSERT INTO activity_logs(action_type, user_name, user_role, details)
         VALUES ($1, $2, $3, $4)`,
        [
          'SHIP',
          user,
          req.user.role,
          JSON.stringify({ productId, binId, qty, reference }),
        ]
      );

      await client.query('COMMIT');
      res.json({ ok: true });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  })
);

// TRANSFER stock
app.post(
  '/transactions/transfer',
  authRequired,
  roleRequired('Worker', 'Manager', 'Admin'),
  idempotencyMiddleware,
  handle(async (req, res) => {
    const { productId, fromBinId, toBinId, qty, reference, user } = req.body;
    if (
      !productId ||
      !fromBinId ||
      !toBinId ||
      fromBinId === toBinId ||
      !qty ||
      qty <= 0
    ) {
      return res.status(400).json({
        error: 'productId, fromBinId!=toBinId, positive qty required',
      });
    }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Check available quantity
      const available = await getQty(client, productId, fromBinId);
      if (available < qty) {
        await client.query('ROLLBACK');
        return res
          .status(400)
          .json({ error: `Only ${available} available in source bin` });
      }

      // Decrease from source bin
      await client.query(
        'UPDATE stock_levels SET qty = qty - $3 WHERE product_id=$1 AND bin_id=$2',
        [productId, fromBinId, qty]
      );

      // Increase in destination bin
      await client.query(
        `INSERT INTO stock_levels(product_id, bin_id, qty)
         VALUES ($1,$2,$3)
         ON CONFLICT (product_id,bin_id) DO UPDATE SET qty=stock_levels.qty+excluded.qty`,
        [productId, toBinId, qty]
      );

      // Record transaction
      await client.query(
        `INSERT INTO stock_transactions(type, product_id, from_bin_id, to_bin_id, qty, reference, performed_by)
         VALUES ('MOVE',$1,$2,$3,$4,$5,$6)`,
        [productId, fromBinId, toBinId, qty, reference || null, user || 'api']
      );

      // Log activity
      await client.query(
        `INSERT INTO activity_logs(action_type, user_name, user_role, details)
         VALUES ($1, $2, $3, $4)`,
        [
          'TRANSFER',
          user,
          req.user.role,
          JSON.stringify({
            productId,
            fromBinId,
            toBinId,
            qty,
            reference,
          }),
        ]
      );

      await client.query('COMMIT');
      res.json({ ok: true });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  })
);

// ============================================
// ADMIN & REPORTING ENDPOINTS
// ============================================

// Activity logs
app.get(
  '/admin/logs',
  authRequired,
  roleRequired('Manager', 'Admin'),
  handle(async (req, res) => {
    const { limit = 100, offset = 0 } = req.query;

    const { rows } = await pool.query(
      `SELECT * FROM activity_logs 
       ORDER BY timestamp DESC 
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    res.json(rows);
  })
);

// Product transaction history
app.get(
  '/products/:id/transactions',
  authRequired,
  handle(async (req, res) => {
    const { id } = req.params;
    const { rows } = await pool.query(
      `
    SELECT 
      st.*,
      fb.code as from_bin_code,
      tb.code as to_bin_code,
      fl.name as from_location_name,
      tl.name as to_location_name
    FROM stock_transactions st
    LEFT JOIN bins fb ON st.from_bin_id = fb.id
    LEFT JOIN bins tb ON st.to_bin_id = tb.id
    LEFT JOIN locations fl ON fb.location_id = fl.id
    LEFT JOIN locations tl ON tb.location_id = tl.id
    WHERE st.product_id = $1
    ORDER BY st.occurred_at DESC
    LIMIT 200
  `,
      [id]
    );
    res.json(rows);
  })
);

// Manual email digest trigger (for testing)
app.post(
  '/admin/send-digest',
  authRequired,
  roleRequired('Manager', 'Admin'),
  handle(async (req, res) => {
    console.log('📧 Manual email digest triggered by', req.user.name);
    const result = await sendTestDigest();
    res.json(result);
  })
);

// Low stock view
app.get(
  '/admin/low-stock',
  authRequired,
  roleRequired('Manager', 'Admin'),
  handle(async (req, res) => {
    const { rows } = await pool.query('SELECT * FROM v_low_stock');
    res.json(rows);
  })
);

// ============================================
// SERVER STARTUP
// ============================================

const port = process.env.PORT || 3000;
let server;

// Only start the server when running directly (not during tests)
if (require.main === module) {
  server = app.listen(port, () => {
    console.log(`🚀 API listening on http://localhost:${port}`);
    console.log(`📧 Email scheduler initialized`);
    console.log(`🔐 Idempotency middleware active`);
  });
}

// Graceful shutdown
process.on('SIGTERM', () => {
  if (server) {
    console.log('SIGTERM received, shutting down gracefully...');
    server.close(() => {
      console.log('HTTP server closed');
      pool.end();
      process.exit(0);
    });
  } else {
    // If no server (e.g., running only in tests), just close the pool
    pool.end().then(() => process.exit(0));
  }
});

// Export the Express app so Jest/Supertest can use it
module.exports = app;
