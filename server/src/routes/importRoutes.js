// server/routes/importRoutes.js
// Handles CSV imports for shipment receiving, reconciliation, and catalog uploads

const express = require("express");
const multer = require("multer");
const fs = require("fs");
const csv = require("csv-parser");
const { Pool } = require("pg");
const { authRequired, roleRequired } = require("../auth");

const router = express.Router();
const upload = multer({ dest: "uploads/" });

// Connects to PostgreSQL using environment variables
const pool = new Pool({
    host: process.env.PGHOST || "localhost",
    port: Number(process.env.PGPORT || 5432),
    user: process.env.PGUSER || "postgres",
    password: String(process.env.PGPASSWORD ?? ""),
    database: process.env.PGDATABASE || "warehouse",
    ssl: (/require/i).test(process.env.PGSSLMODE || "")
        ? { rejectUnauthorized: false }
        : false,
});

// Handles CSV upload and import logic
router.post(
    "/csv",
    authRequired,
    roleRequired("Worker", "Manager", "Admin"),
    upload.single("file"),
    async (req, res) => {
        // Stop if no file is provided
        if (!req.file) return res.status(400).json({ error: "No file uploaded" });

        const type = req.body.type || "shipment";
        const filePath = req.file.path;
        const client = await pool.connect();

        try {
            // Parse CSV into an array of rows
            const rows = [];
            await new Promise((resolve, reject) => {
                fs.createReadStream(filePath)
                    .pipe(csv())
                    .on("data", (data) => rows.push(data))
                    .on("end", resolve)
                    .on("error", reject);
            });

            // Abort if no rows found
            if (!rows.length)
                return res.status(400).json({ error: "CSV appears empty" });

            let importedCount = 0;
            await client.query("BEGIN");

            // Loop through every row of the CSV
            for (const row of rows) {
                // Function to safely retrieve and clean a field from CSV
                const get = (key) => {
                    const val =
                        row[key] ||
                        row[key?.toLowerCase?.()] ||
                        row[key?.toUpperCase?.()] ||
                        "";
                    return typeof val === "string" ? val.trim() : val;
                };

                // Extract fields safely, allowing missing values for catalog imports
                const location = (get("location") || "").toLowerCase();
                const productName = ((get("product") || get("name")) || "").toLowerCase();
                const bin = ((get("bin") || get("bin_code")) || "").toLowerCase();
                const qty = Number(get("qty") || get("quantity") || 0);
                const sku = get("sku");
                const description = get("description");

                // --- Catalog import type: New Product Upload ---
                // Only inserts new products into the database
                if (type === "catalog") {
                    // Skip invalid rows without a name or SKU
                    if (!productName && !sku) continue;

                    // Check if the product already exists by SKU or name
                    const existing = await client.query(
                        "SELECT id FROM products WHERE LOWER(sku)=LOWER($1) OR LOWER(name)=LOWER($2)",
                        [sku, productName]
                    );

                    // Insert new product if not found
                    if (existing.rowCount === 0) {
                        await client.query(
                            "INSERT INTO products(sku, name, description) VALUES ($1,$2,$3)",
                            [sku || null, productName, description || ""]
                        );
                        importedCount++;
                    }

                    // Skip remaining shipment/reconcile logic for catalog uploads
                    continue;
                }

                // Skip if row is incomplete or invalid for shipment/reconcile
                if (!location || !bin || !productName || qty <= 0) continue;

                // Find or create matching location
                const locRes = await client.query(
                    "SELECT id FROM locations WHERE LOWER(name)=LOWER($1)",
                    [location]
                );
                const locationId =
                    locRes.rowCount > 0
                        ? locRes.rows[0].id
                        : (
                            await client.query(
                                "INSERT INTO locations(name) VALUES ($1) RETURNING id",
                                [location]
                            )
                        ).rows[0].id;

                // Find or create matching bin
                const binRes = await client.query(
                    "SELECT id FROM bins WHERE location_id=$1 AND LOWER(code)=LOWER($2)",
                    [locationId, bin]
                );
                const binId =
                    binRes.rowCount > 0
                        ? binRes.rows[0].id
                        : (
                            await client.query(
                                "INSERT INTO bins(location_id, code) VALUES ($1,$2) RETURNING id",
                                [locationId, bin]
                            )
                        ).rows[0].id;

                // Find or create matching product
                let productId;
                const prodRes = await client.query(
                    "SELECT id FROM products WHERE LOWER(name)=LOWER($1)",
                    [productName]
                );
                if (prodRes.rowCount > 0) {
                    productId = prodRes.rows[0].id;
                } else {
                    const nextSkuRes = await client.query(
                        "SELECT COALESCE(MAX(CAST(SUBSTRING(sku FROM 5) AS INTEGER)),0)+1 AS next FROM products"
                    );
                    const nextSku = `SKU-${String(nextSkuRes.rows[0].next).padStart(
                        3,
                        "0"
                    )}`;
                    const insert = await client.query(
                        "INSERT INTO products(sku, name) VALUES ($1,$2) RETURNING id",
                        [nextSku, productName]
                    );
                    productId = insert.rows[0].id;
                }

                // Update or insert stock depending on import type
                if (type === "shipment") {
                    await client.query(
                        `INSERT INTO stock_levels(product_id, bin_id, qty)
             VALUES ($1,$2,$3)
             ON CONFLICT (product_id,bin_id)
             DO UPDATE SET qty=stock_levels.qty+excluded.qty`,
                        [productId, binId, qty]
                    );
                } else if (type === "reconcile") {
                    await client.query(
                        `INSERT INTO stock_levels(product_id, bin_id, qty)
             VALUES ($1,$2,$3)
             ON CONFLICT (product_id,bin_id)
             DO UPDATE SET qty=excluded.qty`,
                        [productId, binId, qty]
                    );
                }

                importedCount++;
            }

            // Finalize database transaction
            await client.query("COMMIT");

            // Send success response
            res.json({
                ok: true,
                imported: importedCount,
                message: `Import complete (${type})`,
            });
        } catch (err) {
            // Roll back transaction on any error
            await client.query("ROLLBACK");
            res.status(500).json({ error: "CSV import failed" });
        } finally {
            // Release database connection and remove uploaded file
            client.release();
            fs.unlinkSync(filePath);
        }
    }
);

module.exports = router;
