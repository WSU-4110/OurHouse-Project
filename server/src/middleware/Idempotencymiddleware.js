const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: Number(process.env.PGPORT || 5432),
  user: process.env.PGUSER || 'postgres',
  password: String(process.env.PGPASSWORD ?? ''),
  database: process.env.PGDATABASE || 'OurHouse',
  ssl: (/require/i).test(process.env.PGSSLMODE || '') ? { rejectUnauthorized: false } : false,
});

const cache = new Map();
const CACHE_TTL = 1000 * 60 * 5; 

//cleans up expired cache entries
function cleanupCache() {
  const now = Date.now();
  for (const [key, value] of cache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      cache.delete(key);
    }
  }
}

//runs cleanup every minute
setInterval(cleanupCache, 60000);

async function idempotencyMiddleware(req, res, next) {
  const idempotencyKey = req.headers['idempotency-key'] || req.headers['x-idempotency-key'];
  if (!idempotencyKey) {
    return next();
  }
  
  if (typeof idempotencyKey !== 'string' || idempotencyKey.length < 10 || idempotencyKey.length > 255) {
    return res.status(400).json({ 
      error: 'Invalid Idempotency-Key format. Must be 10-255 characters.' 
    });
  }
  
  try {
    //checks cache first (fast path)
    if (cache.has(idempotencyKey)) {
      const cached = cache.get(idempotencyKey);
      console.log(`⚡ Idempotency cache hit: ${idempotencyKey}`);
      return res.status(cached.status).json(cached.response);
    }
    
    //checks for existing request
    const result = await pool.query(
      `SELECT status_code, response_body, created_at 
       FROM idempotency_keys 
       WHERE key = $1 
       AND created_at > NOW() - INTERVAL '24 hours'`,
      [idempotencyKey]
    );
    
    if (result.rows.length > 0) {
      const record = result.rows[0];
      console.log(`🔄 Duplicate request detected: ${idempotencyKey}`);
      cache.set(idempotencyKey, {
        status: record.status_code,
        response: record.response_body,
        timestamp: Date.now()
      });
      
      return res.status(record.status_code).json(record.response_body);
    }
    
    //stores key in request for later use
    req.idempotencyKey = idempotencyKey;
    
    //intercepts response to store result
    const originalJson = res.json.bind(res);
    res.json = function(body) {
      //stores in database asynchronously (don't block response)
      const statusCode = res.statusCode;
      storeIdempotencyResult(idempotencyKey, statusCode, body).catch(err => {
        console.error('Failed to store idempotency key:', err);
      });
      cache.set(idempotencyKey, {
        status: statusCode,
        response: body,
        timestamp: Date.now()
      });
      
      return originalJson(body);
    };
    
    next();
    
  } catch (error) {
    console.error('Idempotency check failed:', error);
    next();
  }
}

/**
 * Store idempotency result in database
 * @param {string} key - Idempotency key
 * @param {number} statusCode - HTTP status code
 * @param {Object} responseBody - Response body
 */
async function storeIdempotencyResult(key, statusCode, responseBody) {
  try {
    await pool.query(
      `INSERT INTO idempotency_keys (key, status_code, response_body)
       VALUES ($1, $2, $3)
       ON CONFLICT (key) DO NOTHING`,
      [key, statusCode, responseBody]
    );
  } catch (error) {
    console.error('Failed to store idempotency key:', error);
    throw error;
  }
}

 //removes keys older than 24 hours
async function cleanupOldKeys() {
  try {
    const result = await pool.query(
      `DELETE FROM idempotency_keys 
       WHERE created_at < NOW() - INTERVAL '24 hours'
       RETURNING key`
    );
    console.log(`🧹 Cleaned up ${result.rowCount} old idempotency keys`);
    return result.rowCount;
  } catch (error) {
    console.error('Failed to cleanup idempotency keys:', error);
    throw error;
  }
}

//daily cleanup at 2 am
const cron = require('node-cron');
cron.schedule('0 2 * * *', async () => {
  console.log('⏰ Running daily idempotency key cleanup');
  await cleanupOldKeys();
});

module.exports = {
  idempotencyMiddleware,
  cleanupOldKeys
};