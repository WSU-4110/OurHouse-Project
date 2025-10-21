// server/routes/exportRoutes.js
const express = require("express");
const { Parser } = require("json2csv");
const { Pool } = require("pg");
const { authRequired, roleRequired } = require("../auth");

const router = express.Router();

const pool = new Pool({
    host: process.env.PGHOST || "localhost",
    port: Number(process.env.PGPORT || 5432),
    user: process.env.PGUSER || "postgres",
    password: String(process.env.PGPASSWORD ?? ""),
    database: process.env.PGDATABASE || "warehouse",
    ssl: (/require/i).test(process.env.PGSSLMODE || "") ? { rejectUnauthorized: false } : false,
});

router.get("/csv", authRequired, roleRequired("Worker", "Manager", "Admin"), async (req, res) => {
    const mode = req.query.mode || "snapshot";
    console.log("Export mode:", mode);

    try {
        let query = "";
        let filename = "export.csv";

        switch (mode) {
            case "snapshot":
                query = `
          SELECT 
            l.name AS location,
            p.sku,
            p.name AS product,
            b.code AS bin,
            s.qty AS quantity
          FROM stock_levels s
          JOIN products p ON s.product_id = p.id
          JOIN bins b ON s.bin_id = b.id
          JOIN locations l ON b.location_id = l.id
          ORDER BY l.name, p.name, b.code
        `;
                filename = "snapshot_export.csv";
                break;

            case "locations":
                query = `
          SELECT 
            l.name AS location,
            COUNT(DISTINCT b.id) AS total_bins,
            SUM(s.qty) AS total_items
          FROM locations l
          LEFT JOIN bins b ON b.location_id = l.id
          LEFT JOIN stock_levels s ON s.bin_id = b.id
          GROUP BY l.name
          ORDER BY l.name
        `;
                filename = "location_export.csv";
                break;

            case "products":
                query = `
          SELECT 
            p.sku,
            p.name AS product_name,
            p.description,
            p.unit,
            COALESCE(SUM(s.qty), 0) AS total_quantity
          FROM products p
          LEFT JOIN stock_levels s ON s.product_id = p.id
          GROUP BY p.id
          ORDER BY p.name
        `;
                filename = "products_export.csv";
                break;

            default:
                return res.status(400).json({ error: "Invalid export mode" });
        }

        const result = await pool.query(query);
        const parser = new Parser();
        const csv = parser.parse(result.rows);

        res.header("Content-Type", "text/csv");
        res.attachment(filename);
        res.send(csv);
    } catch (err) {
        console.error("CSV export failed:", err.message);
        res.status(500).json({ error: "Failed to export CSV" });
    }
});

module.exports = router;
