import { Component } from "../simulation/component";

export class TestDriver extends Component {
  constructor(output, signal) {
    super({ output });
    this.signal = signal;
  }

  eval() {
    return [
      {
        netId: this.terminals.output,
        driverId: this.driverId,
        signal: this.signal,
      },
    ];
  }
}
