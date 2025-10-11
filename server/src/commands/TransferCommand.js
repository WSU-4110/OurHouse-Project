const { MovementCommand } = require('./MovementCommand');

class TransferCommand extends MovementCommand {
  validate() {
    const { productId, fromBinId, toBinId, qty } = this.input;
    if (!productId || !fromBinId || !toBinId || fromBinId === toBinId || !qty || qty <= 0) {
      throw new Error('productId, fromBinId!=toBinId, positive qty required');
    }
  }

  async execute(client, repo) {
    const { productId, fromBinId, toBinId, qty, reference, user } = this.input;
    const available = await repo.getQty(client, productId, fromBinId);
    if (available < +qty) throw new Error(`Only ${available} available in source bin`);
    await repo.upsertQty(client, productId, fromBinId, -Math.abs(+qty));
    await repo.upsertQty(client, productId, toBinId, +Math.abs(+qty));
    await repo.insertLedgerMove(client, { productId, fromBinId, toBinId, qty: +qty, reference, user });
    return { ok: true };
  }
}

module.exports = { TransferCommand };
