// server/src/server.js
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const { Parser } = require('json2csv');
require('dotenv').config();
const {authRequired, roleRequired} = require('./auth');
const authRoutes = require('./routes/authRoutes');
const stockRoutes = require('./routes/stockRoutes');

const app = express();
const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';
app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(express.json());
app.use('/auth', authRoutes);
app.use('/stock', stockRoutes);

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
app.post('/transactions/receive', authRequired, roleRequired('Worker', 'Manager', 'Admin'), handle(async (req, res) => {
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
    await client.query(
      `INSERT INTO activity_logs(action_type, user_name, user_role, details)
      VALUES ($1, $2, $3, $4)`,
      ['RECEIVE', user, req.user.role, JSON.stringify({ productId, binId, qty, reference })]
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
app.post('/transactions/ship', authRequired, roleRequired('Worker', 'Manager', 'Admin'), handle(async (req, res) => {
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
    await client.query(
      `INSERT INTO activity_logs(action_type, user_name, user_role, details)
      VALUES ($1, $2, $3, $4)`,
      ['SHIP', user, req.user.role, JSON.stringify({ productId, binId, qty, reference })]
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
    await client.query(
      `INSERT INTO activity_logs(action_type, user_name, user_role, details)
      VALUES ($1, $2, $3, $4)`,
      ['MOVE', user, req.user.role, JSON.stringify({ productId, binId, qty, reference })]
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

app.post('/admin/products', authRequired, roleRequired('Manager', 'Admin'), handle(async (req, res) => {
  const { sku, name, description, unit } = req.body;
  if (!sku || !name) {
    return res.status(400).json({ error: 'SKU and name are required' });
  }

   const { rows } = await pool.query(
    `INSERT INTO products (sku, name, description, unit)
     VALUES ($1, $2, $3, $4)
     RETURNING id, sku, name, description, unit`,
    [sku, name, description || '', unit || 'each']
  );
  
  res.json(rows[0]);
}));

app.post('/admin/locations', authRequired, roleRequired('Manager', 'Admin'), handle(async (req, res) => {
  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Location name is required' });
  }
  
  const { rows } = await pool.query(
    `INSERT INTO locations (name)
     VALUES ($1)
     RETURNING id, name`,
    [name]
  );

  res.json(rows[0]);
}));

app.post('/admin/bins', authRequired, roleRequired('Manager', 'Admin'), handle(async (req, res) => {
  const { locationId, code } = req.body;
  if (!locationId || !code) {
    return res.status(400).json({ error: 'Location ID and bin code are required' });
  }
  
  const { rows } = await pool.query(
    `INSERT INTO bins (location_id, code)
     VALUES ($1, $2)
     RETURNING id, location_id, code`,
    [locationId, code]
  );
  
  res.json(rows[0]);
}));

app.delete('/admin/products/:id', authRequired, roleRequired('Manager', 'Admin'), handle(async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    //checks if product has stock
    const { rows: stockCheck } = await client.query(
      'SELECT COUNT(*) as count FROM stock_levels WHERE product_id = $1 AND qty > 0',
      [id]
    );
    
    if (Number(stockCheck[0].count) > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Cannot delete product with existing stock' });
    }
    
    //gets product info to log
    const { rows: product } = await client.query('SELECT * FROM products WHERE id = $1', [id]);
    
    //deletes stock
    await client.query('DELETE FROM stock_levels WHERE product_id = $1', [id]);
    
    //deletes product
    await client.query('DELETE FROM products WHERE id = $1', [id]);
    
    //logs action
    await client.query(
      `INSERT INTO activity_logs(action_type, user_name, user_role, details)
       VALUES ($1, $2, $3, $4)`,
      ['DELETE_PRODUCT', req.user.name, req.user.role, JSON.stringify(product[0])]
    );
    
    await client.query('COMMIT');
    res.json({ ok: true, message: 'Product deleted successfully' });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}));

app.delete('/admin/locations/:id', authRequired, roleRequired('Manager', 'Admin'), handle(async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    //checks for location bins with stock
    const { rows: stockCheck } = await client.query(
      `SELECT COUNT(*) as count FROM stock_levels sl
       JOIN bins b ON sl.bin_id = b.id
       WHERE b.location_id = $1 AND sl.qty > 0`,
      [id]
    );
    
    if (Number(stockCheck[0].count) > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Cannot delete location with stock in bins' });
    }
    
    //gets location info for logging
    const { rows: location } = await client.query('SELECT * FROM locations WHERE id = $1', [id]);
    
    //deletes bin and stock 
    await client.query(
      'DELETE FROM stock_levels WHERE bin_id IN (SELECT id FROM bins WHERE location_id = $1)',
      [id]
    );
    await client.query('DELETE FROM bins WHERE location_id = $1', [id]);
    
    //delete location
    await client.query('DELETE FROM locations WHERE id = $1', [id]);
    
    //logs action
    await client.query(
      `INSERT INTO activity_logs(action_type, user_name, user_role, details)
       VALUES ($1, $2, $3, $4)`,
      ['DELETE_LOCATION', req.user.name, req.user.role, JSON.stringify(location[0])]
    );
    
    await client.query('COMMIT');
    res.json({ ok: true, message: 'Location deleted successfully' });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}));

app.delete('/admin/bins/:id', authRequired, roleRequired('Manager', 'Admin'), handle(async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    //checks for stock in bin
    const { rows: stockCheck } = await client.query(
      'SELECT COUNT(*) as count FROM stock_levels WHERE bin_id = $1 AND qty > 0',
      [id]
    );
    
    if (Number(stockCheck[0].count) > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Cannot delete bin with existing stock' });
    }
    
    //bin info for logging
    const { rows: bin } = await client.query(
      'SELECT b.*, l.name as location_name FROM bins b JOIN locations l ON b.location_id = l.id WHERE b.id = $1',
      [id]
    );
    
    //delete stock
    await client.query('DELETE FROM stock_levels WHERE bin_id = $1', [id]);
    
    //delete bin
    await client.query('DELETE FROM bins WHERE id = $1', [id]);
    
    //log action
    await client.query(
      `INSERT INTO activity_logs(action_type, user_name, user_role, details)
       VALUES ($1, $2, $3, $4)`,
      ['DELETE_BIN', req.user.name, req.user.role, JSON.stringify(bin[0])]
    );
    
    await client.query('COMMIT');
    res.json({ ok: true, message: 'Bin deleted successfully' });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}));

//activity logs
app.get('/admin/logs', authRequired, roleRequired('Manager', 'Admin'), handle(async (req, res) => {
  const { limit = 100, offset = 0 } = req.query;
  
  const { rows } = await pool.query(
    `SELECT * FROM activity_logs 
     ORDER BY timestamp DESC 
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  
  res.json(rows);
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

app.get('/export/csv', authRequired, roleRequired('Manager', 'Admin'), async (req, res) => {
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

// --- IMPORT CSV ---
const multer = require("multer");
const fs = require("fs");
const csv = require("csv-parser");

// Temporary file storage
const upload = multer({ dest: "uploads/" });

app.post("/import/csv", authRequired, roleRequired('Manager', 'Admin'), upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const filePath = req.file.path;
  const client = await pool.connect();

  try {
    const rows = [];
    await new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csv())
        .on("data", (data) => rows.push(data))
        .on("end", resolve)
        .on("error", reject);
    });

    await client.query("BEGIN");

    for (const row of rows) {
      const { location, product, bin, quantity } = row;

      //location
      let locRes = await client.query(
        "SELECT id FROM locations WHERE name = $1",
        [location]
      );
      let locationId;
      if (locRes.rows.length === 0) {
        const insertLoc = await client.query(
          "INSERT INTO locations(name) VALUES ($1) RETURNING id",
          [location]
        );
        locationId = insertLoc.rows[0].id;
      } else {
        locationId = locRes.rows[0].id;
      }

      //bin
      let binRes = await client.query(
        "SELECT id FROM bins WHERE location_id = $1 AND code = $2",
        [locationId, bin]
      );
      let binId;
      if (binRes.rows.length === 0) {
        const insertBin = await client.query(
          "INSERT INTO bins(location_id, code) VALUES ($1, $2) RETURNING id",
          [locationId, bin]
        );
        binId = insertBin.rows[0].id;
      } else {
        binId = binRes.rows[0].id;
      }

      //product 
      let prodRes = await client.query(
        "SELECT id FROM products WHERE name = $1",
        [product]
      );
      let productId;
      if (prodRes.rows.length === 0) {
        const insertProd = await client.query(
          "INSERT INTO products(name) VALUES ($1) RETURNING id",
          [product]
        );
        productId = insertProd.rows[0].id;
      } else {
        productId = prodRes.rows[0].id;
      }

      //stock 
      // Add to existing quantity (not replace)
      let stockRes = await client.query(
        "SELECT qty FROM stock_levels WHERE product_id = $1 AND bin_id = $2",
        [productId, binId]
      );

      if (stockRes.rows.length === 0) {
        await client.query(
          "INSERT INTO stock_levels(product_id, bin_id, qty) VALUES ($1, $2, $3)",
          [productId, binId, quantity]
        );
      } else {
        const newQty =
          Number(stockRes.rows[0].qty) + Number(quantity);
        await client.query(
          "UPDATE stock_levels SET qty = $3 WHERE product_id = $1 AND bin_id = $2",
          [productId, binId, newQty]
        );
      }

      // transactions
      await client.query(
        `INSERT INTO stock_transactions(type, product_id, to_bin_id, qty, reference, performed_by)
         VALUES ('IN', $1, $2, $3, $4, $5)`,
        [productId, binId, quantity, "CSV Import (Shipment Received)", "system"]
      );
    }

    await client.query("COMMIT");
    res.json({ ok: true, imported: rows.length });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Import failed:", err);
    res.status(500).json({ error: "CSV import failed" });
  } finally {
    client.release();
    fs.unlinkSync(filePath);
  }
});





