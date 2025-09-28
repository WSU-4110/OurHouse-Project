// server/src/dbtest.js
require('dotenv').config();
const { Client } = require('pg');

console.log('PG env snapshot:', {
  host: process.env.PGHOST,
  port: process.env.PGPORT,
  user: process.env.PGUSER,
  database: process.env.PGDATABASE,
  password_type: typeof process.env.PGPASSWORD,
  has_password: !!process.env.PGPASSWORD
});

const client = new Client({
  host: process.env.PGHOST || 'localhost',
  port: Number(process.env.PGPORT || 5432),
  user: process.env.PGUSER || 'postgres',
  database: process.env.PGDATABASE || 'OurHouse',
  password: String(process.env.PGPASSWORD ?? '')
});

client.connect()
  .then(() => client.query('select current_database() db, current_user usr, now() ts'))
  .then(r => { console.log('✅ Connected OK:', r.rows[0]); return client.end(); })
  .catch(err => { console.error('❌ Connect failed:', err.message); process.exit(1); });
