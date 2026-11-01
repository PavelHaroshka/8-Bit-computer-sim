import { SIGNAL } from "./signals";

export class Component {
  constructor(terminals) {
    this.terminals = terminals;
  }

  eval() {
    return {
      netId: this.terminals.output,
      driverId: this.driverId,
      signal: SIGNAL.HIGH,
    };
  }
}
