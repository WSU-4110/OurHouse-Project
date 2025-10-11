const { MovementCommand } = require('./MovementCommand');

class ReceiveCommand extends MovementCommand {
  validate() {
    const { productId, binId, qty } = this.input;
    if (!productId || !binId || !qty || qty <= 0) {
      throw new Error('productId, binId, positive qty required');
    }
  }

  async execute(client, repo) {
    const { productId, binId, qty, reference, user } = this.input;
    await repo.upsertQty(client, productId, binId, +qty);
    await repo.insertLedgerIn(client, { productId, toBinId: binId, qty: +qty, reference, user });
    return { ok: true };
  }
}

module.exports = { ReceiveCommand };
