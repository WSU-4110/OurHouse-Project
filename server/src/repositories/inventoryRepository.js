const { Pool } = require('pg');
const pool = new Pool(); 

class InventoryRepository {
  async withClient(fn) {
    const client = await pool.connect();
    try { return await fn(client); } finally { client.release(); }
  }

  async begin(client) { await client.query('begin'); }
  async commit(client) { await client.query('commit'); }
  async rollback(client) { await client.query('rollback'); }

  async getQty(client, productId, binId) {
    const { rows } = await client.query(
      'select qty from stock_levels where product_id=$1 and bin_id=$2',
      [productId, binId]
    );
    return rows[0]?.qty ? Number(rows[0].qty) : 0;
  }

  async upsertQty(client, productId, binId, delta) {
    if (delta >= 0) {
      await client.query(
        `insert into stock_levels(product_id, bin_id, qty)
         values ($1,$2,$3)
         on conflict (product_id,bin_id) do update set qty=stock_levels.qty+excluded.qty`,
        [productId, binId, delta]
      );
    } else {
      await client.query(
        `update stock_levels set qty = qty + $3
         where product_id=$1 and bin_id=$2`,
        [productId, binId, delta]
      );
    }
  }

  async insertLedgerIn(client, { productId, toBinId, qty, reference, user }) {
    await client.query(
      `insert into stock_transactions(type, product_id, to_bin_id, qty, reference, performed_by)
       values ('IN',$1,$2,$3,$4,$5)`,
      [productId, toBinId, qty, reference || null, user || 'api']
    );
  }

  async insertLedgerOut(client, { productId, fromBinId, qty, reference, user }) {
    await client.query(
      `insert into stock_transactions(type, product_id, from_bin_id, qty, reference, performed_by)
       values ('OUT',$1,$2,$3,$4,$5)`,
      [productId, fromBinId, qty, reference || null, user || 'api']
    );
  }

  async insertLedgerMove(client, { productId, fromBinId, toBinId, qty, reference, user }) {
    await client.query(
      `insert into stock_transactions(type, product_id, from_bin_id, to_bin_id, qty, reference, performed_by)
       values ('MOVE',$1,$2,$3,$4,$5,$6)`,
      [productId, fromBinId, toBinId, qty, reference || null, user || 'api']
    );
  }
}

module.exports = { InventoryRepository };
