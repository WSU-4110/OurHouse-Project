class MovementCommand {
  // subclasses must implement validate() and execute(client)
  constructor(input) { this.input = input; }
  validate() { throw new Error('validate not implemented'); }
  async execute(/* client, repo */) { throw new Error('execute not implemented'); }
}
module.exports = { MovementCommand };
