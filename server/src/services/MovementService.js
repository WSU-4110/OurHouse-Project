const { InventoryRepository } = require('../repositories/inventoryRepository');

class MovementService {
  constructor() { this.repo = new InventoryRepository(); }

  async run(command) {
    // 1) validate before opening a transaction
    command.validate();

    // 2) do everything inside one ACID txn
    return await this.repo.withClient(async (client) => {
      try {
        await this.repo.begin(client);
        const result = await command.execute(client, this.repo);
        await this.repo.commit(client);
        return result;
      } catch (err) {
        await this.repo.rollback(client);
        throw err;
      }
    });
  }
}

module.exports = { MovementService };
