import { Component } from "../../simulation/component";
import { SIGNAL } from "../../simulation/signals";

export class MSJKFlipFlop extends Component {
  constructor(sim, { j, k, clock, q, qBar, initialState = SIGNAL.LOW }) {
    super({ j, k, clock, q, qBar });
    this.state = initialState;
    this.prevClock = null;
    sim.addComponent(this);
  }

  eval(wires) {
    const clk = wires[this.terminals.clock];

    // master/slave behavior: sample J and K on the falling clock edge only
    if (this.prevClock === SIGNAL.HIGH && clk === SIGNAL.LOW) {
      const j = wires[this.terminals.j] === SIGNAL.HIGH;
      const k = wires[this.terminals.k] === SIGNAL.HIGH;

      if (j && k) {
        this.state = this.state === SIGNAL.HIGH ? SIGNAL.LOW : SIGNAL.HIGH;
      } else if (j) {
        this.state = SIGNAL.HIGH;
      } else if (k) {
        this.state = SIGNAL.LOW;
      }
      // J = K = 0 (or unknown inputs): hold
    }
    this.prevClock = clk;

    const bar = this.state === SIGNAL.HIGH ? SIGNAL.LOW : SIGNAL.HIGH;
    return [
      {
        netId: this.terminals.q,
        driverId: this.driverId,
        strength: "strong",
        signal: this.state,
      },
      {
        netId: this.terminals.qBar,
        driverId: this.driverId,
        strength: "strong",
        signal: bar,
      },
    ];
  }
}
