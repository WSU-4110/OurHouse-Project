// Handles CSV imports for shipment receiving, reconciliation, and catalog uploads

const express = require("express");
const multer = require("multer");
const fs = require("fs");
const csv = require("csv-parser");
const { Pool } = require("pg");
//const { authRequired, roleRequired } = require("../auth");
const { requireAuth: authRequired, requireRole: roleRequired } = require("../auth/requireAuth");

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

// Helper: normalize CSV headers to remove BOM and spaces
function cleanHeader(header) {
    return (header || "").replace(/^\uFEFF/, "").trim().toLowerCase();
}

// Helper: normalize units to a canonical form (avoid duplicates like "Crate" vs "crate")
function normalizeUnit(u) {
    if (!u || typeof u !== "string") return "each";
    const raw = u.trim().toLowerCase();
    // Simple synonym/plural normalization
    const map = {
        ea: "each",
        each: "each",
        unit: "each",
        units: "each",
        piece: "each",
        pieces: "each",

        box: "box",
        boxes: "box",

        bag: "bag",
        bags: "bag",

        crate: "crate",
        crates: "crate",

        case: "case",
        cases: "case",

        bunch: "bunch",
        bunches: "bunch",

        pack: "pack",
        packs: "pack",
    };
    return map[raw] || raw; // default to lowercased raw value if not mapped
}

// Handles CSV upload and import logic
router.post(
    "/csv",
    authRequired,
    roleRequired("Worker", "Manager", "Admin"),
    upload.single("file"),
    async (req, res) => {
        // Stop if no file is provided
        if (!req.file) return res.status(400).json({ error: "No file uploaded" });

        // Accept both CSV MIME types
        const okTypes = ["text/csv", "application/vnd.ms-excel"];
        if (!okTypes.includes(req.file.mimetype)) {
            if (!/\.csv$/i.test(req.file.originalname)) {
                fs.unlink(req.file.path, () => {});
                return res.status(400).json({ error: "Invalid file type. Please upload a CSV file." });
            }
        }

        const type = req.body.type || "shipment";
        const filePath = req.file.path;
        const client = await pool.connect();

        try {
            // Parse CSV into an array of rows
            const rows = [];
            await new Promise((resolve, reject) => {
                fs.createReadStream(filePath)
                    .pipe(csv({ mapHeaders: ({ header }) => cleanHeader(header) }))
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

                // Extract fields safely and preserve original casing
                const locationRaw = get("location") || "";
                const productRaw = get("product") || get("name") || "";
                const binRaw = get("bin") || get("bin_code") || "";
                const location = locationRaw.trim();
                const productName = productRaw.trim();

                // Always store bins in uppercase but match case-insensitively
                const bin = binRaw.trim().toUpperCase();
                const binLookup = bin.toLowerCase();

                // Use lowercase copies for case-insensitive matching
                const locationLookup = location.toLowerCase();
                const productLookup = productName.toLowerCase();

                // Sanitize numeric quantity (allow "1,000" style)
                const qty = Number((get("qty") || get("quantity") || "0").replace(/,/g, ""));

                const sku = get("sku");
                const description = get("description");
                // Normalize units (e.g., "Crates" -> "crate")
                const unit = normalizeUnit(get("unit") || "each");

                // Catalog import type: New Product Upload (product rows only)
                if (type === "catalog") {
                    // Skip invalid rows without a name or SKU
                    if (!productName && !sku) continue;

                    // Strategy: products are unique by (lower(name), normalized unit).
                    // Also consider SKU if provided (but SKU is unique to a specific unit).
                    let productId = null;

                    // If SKU is provided, look it up first
                    if (sku) {
                        const bySku = await client.query(
                            "SELECT id, unit FROM products WHERE LOWER(sku)=LOWER($1)",
                            [sku.toLowerCase()]
                        );
                        if (bySku.rowCount > 0) {
                            const existingUnit = (bySku.rows[0].unit || "").toLowerCase();
                            if (existingUnit === unit) {
                                productId = bySku.rows[0].id; // same SKU + same unit → reuse
                            } else {
                                productId = null; // same SKU but different unit → create new product
                            }
                        }
                    }

                    // If no product by SKU, look by (name, unit)
                    if (!productId) {
                        const byNU = await client.query(
                            "SELECT id FROM products WHERE LOWER(name)=LOWER($1) AND LOWER(unit)=LOWER($2)",
                            [productLookup, unit]
                        );
                        if (byNU.rowCount > 0) {
                            productId = byNU.rows[0].id;
                        }
                    }

                    if (!productId) {
                        // Create a new product with auto SKU if needed
                        let finalSku = sku || null;
                        if (!finalSku) {
                            const nextSkuRes = await client.query(
                                "SELECT COALESCE(MAX(CAST(SUBSTRING(sku FROM 5) AS INTEGER)),0)+1 AS next FROM products"
                            );
                            finalSku = `SKU-${String(nextSkuRes.rows[0].next).padStart(3, "0")}`;
                        } else {
                            // If provided SKU exists but with a different unit, we must use a NEW auto SKU
                            const skuExists = await client.query(
                                "SELECT 1 FROM products WHERE LOWER(sku)=LOWER($1)",
                                [finalSku.toLowerCase()]
                            );
                            if (skuExists.rowCount > 0) {
                                const nextSkuRes = await client.query(
                                    "SELECT COALESCE(MAX(CAST(SUBSTRING(sku FROM 5) AS INTEGER)),0)+1 AS next FROM products"
                                );
                                finalSku = `SKU-${String(nextSkuRes.rows[0].next).padStart(3, "0")}`;
                            }
                        }

                        const insert = await client.query(
                            "INSERT INTO products(sku, name, description, unit) VALUES ($1,$2,$3,$4) RETURNING id",
                            [finalSku, productName, description || "", unit]
                        );
                        productId = insert.rows[0].id;
                        importedCount++;
                    } else {
                        // If we found a product with same (name, unit) or (sku, unit),
                        // optionally refresh description if provided
                        if (description && description.length > 0) {
                            await client.query(
                                "UPDATE products SET description = COALESCE(NULLIF($1,''), description) WHERE id = $2",
                                [description, productId]
                            );
                        }
                    }

                    // Skip remaining shipment/reconcile logic for catalog uploads
                    continue;
                }

                // Skip if row is incomplete or invalid for shipment/reconcile
                if (!location || !bin || !productName || qty <= 0) continue;

                // Find or create matching location (case-insensitive check, original insert)
                const locRes = await client.query(
                    "SELECT id FROM locations WHERE LOWER(name)=LOWER($1)",
                    [locationLookup]
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

                // Find bin by case-insensitive match, but always store uppercase
                const binRes = await client.query(
                    "SELECT id, code FROM bins WHERE location_id=$1 AND LOWER(code)=LOWER($2)",
                    [locationId, binLookup]
                );

                let binId;
                if (binRes.rowCount > 0) {
                    // Bin exists - update to uppercase if necessary
                    binId = binRes.rows[0].id;
                    if (binRes.rows[0].code !== bin) {
                        await client.query(
                            "UPDATE bins SET code=$2 WHERE id=$1",
                            [binId, bin]
                        );
                    }
                } else {
                    // Insert new bin with uppercase code
                    const newBin = await client.query(
                        "INSERT INTO bins(location_id, code) VALUES ($1,$2) RETURNING id",
                        [locationId, bin]
                    );
                    binId = newBin.rows[0].id;
                }

                // Resolve product by priority:
                // 1) If SKU provided and matches same unit → use it
                // 2) Else (name, unit) pair
                // 3) Else new product with auto SKU
                let productId = null;

                if (sku) {
                    const bySku = await client.query(
                        "SELECT id, unit FROM products WHERE LOWER(sku)=LOWER($1)",
                        [sku.toLowerCase()]
                    );
                    if (bySku.rowCount > 0) {
                        const existingUnit = (bySku.rows[0].unit || "").toLowerCase();
                        if (existingUnit === unit) {
                            productId = bySku.rows[0].id; // same SKU + same unit
                        } else {
                            productId = null; // same SKU different unit → create new product (new SKU)
                        }
                    }
                }

                if (!productId) {
                    const byNU = await client.query(
                        "SELECT id FROM products WHERE LOWER(name)=LOWER($1) AND LOWER(unit)=LOWER($2)",
                        [productLookup, unit]
                    );
                    if (byNU.rowCount > 0) {
                        productId = byNU.rows[0].id;
                    }
                }

                if (!productId) {
                    // Create a new product row for this (name, unit) combination
                    let finalSku = sku || null;
                    if (!finalSku) {
                        const nextSkuRes = await client.query(
                            "SELECT COALESCE(MAX(CAST(SUBSTRING(sku FROM 5) AS INTEGER)),0)+1 AS next FROM products"
                        );
                        finalSku = `SKU-${String(nextSkuRes.rows[0].next).padStart(3, "0")}`;
                    } else {
                        // If provided SKU already exists, we must not reuse it (belongs to another unit)
                        const skuExists = await client.query(
                            "SELECT 1 FROM products WHERE LOWER(sku)=LOWER($1)",
                            [finalSku.toLowerCase()]
                        );
                        if (skuExists.rowCount > 0) {
                            const nextSkuRes = await client.query(
                                "SELECT COALESCE(MAX(CAST(SUBSTRING(sku FROM 5) AS INTEGER)),0)+1 AS next FROM products"
                            );
                            finalSku = `SKU-${String(nextSkuRes.rows[0].next).padStart(3, "0")}`;
                        }
                    }

                    const insert = await client.query(
                        "INSERT INTO products(sku, name, description, unit) VALUES ($1,$2,$3,$4) RETURNING id",
                        [finalSku, productName, description || "", unit]
                    );
                    productId = insert.rows[0].id;
                } else {
                    // If we matched (name, unit) or (sku, unit), optionally refresh description if CSV provides one
                    if (description && description.length > 0) {
                        await client.query(
                            "UPDATE products SET description = COALESCE(NULLIF($1,''), description) WHERE id = $2",
                            [description, productId]
                        );
                    }
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
            console.error("CSV import error:", err.message);
            res.status(500).json({ error: "CSV import failed" });
        } finally {
            // Release database connection and remove uploaded file
            client.release();
            fs.unlinkSync(filePath);
        }
    }
);

module.exports = router;