const { MovementCommand } = require('./MovementCommand');

class ShipCommand extends MovementCommand {
  validate() {
    const { productId, binId, qty } = this.input;
    if (!productId || !binId || !qty || qty <= 0) {
      throw new Error('productId, binId, positive qty required');
    }
  }

  async execute(client, repo) {
    const { productId, binId, qty, reference, user } = this.input;
    const available = await repo.getQty(client, productId, binId);
    if (available < +qty) throw new Error(`Only ${available} available`);
    await repo.upsertQty(client, productId, binId, -Math.abs(+qty));
    await repo.insertLedgerOut(client, { productId, fromBinId: binId, qty: +qty, reference, user });
    return { ok: true };
  }
}

module.exports = { ShipCommand };
