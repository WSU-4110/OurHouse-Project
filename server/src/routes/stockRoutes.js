// File: server/src/routes/stockRoutes.js
const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
require('dotenv').config();

// Create pool instance (same configuration as server.js)
const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: Number(process.env.PGPORT || 5432),
  user: process.env.PGUSER || 'postgres',
  password: String(process.env.PGPASSWORD ?? ''),
  database: process.env.PGDATABASE || 'OurHouse',
  ssl: (/require/i).test(process.env.PGSSLMODE || '') ? { rejectUnauthorized: false } : false,
});

// GET endpoint to fetch low-stock items (quantity < 10)
router.get('/low-stock', async (req, res) => {
  try {
    const query = `
      SELECT 
        p.sku,
        p.name AS product_name,
        l.name AS location_name,
        b.code AS bin_code,
        sl.qty
      FROM stock_levels sl
      JOIN products p ON p.id = sl.product_id
      JOIN bins b ON b.id = sl.bin_id
      JOIN locations l ON l.id = b.location_id
      WHERE sl.qty < 10
      ORDER BY sl.qty ASC, p.sku ASC
    `;
    
    const result = await pool.query(query);
    
    res.json({
      success: true,
      lowStockItems: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching low-stock items:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch low-stock items'
    });
  }
});

module.exports = router;