import { Component } from "../../simulation/component";
import { SIGNAL } from "../../simulation/signals";

export class ROM extends Component {
  constructor(sim, { address, output, outputEnable, contents = [] }) {
    if (!Array.isArray(address) || address.length === 0) {
      throw new Error("ROM requires an array of address pins.");
    }
    if (!Array.isArray(output) || output.length === 0) {
      throw new Error("ROM requires an array of output pins.");
    }

    const size = 2 ** address.length;
    const limit = 2 ** output.length;

    contents.forEach((value, i) => {
      if (!Number.isInteger(value) || value < 0 || value >= limit) {
        throw new Error(
          `ROM value at address ${i} must be an integer from 0 to ${limit - 1}, got ${value}.`,
        );
      }
    });

    const terminals = {};
    address.forEach((net, i) => (terminals[`a${i}`] = net));
    output.forEach((net, i) => (terminals[`d${i}`] = net));
    if (outputEnable) terminals.oe = outputEnable;

    super(terminals);

    this.sim = sim;
    this.addressNets = address;
    this.outputNets = output;
    this.outputEnable = outputEnable ?? null;
    this.contents = Array.from({ length: size }, (_, i) => contents[i] ?? 0);

    sim.addComponent(this);
  }

  eval(wires) {
    const enabled =
      this.outputEnable === null || wires[this.outputEnable] === SIGNAL.HIGH;

    let address = 0;
    let known = true;

    for (let i = 0; i < this.addressNets.length; i++) {
      const signal = wires[this.addressNets[i]];

      if (signal === SIGNAL.HIGH) {
        address |= 1 << i;
      } else if (signal !== SIGNAL.LOW) {
        known = false;
      }
    }

    const value = known ? this.contents[address] : 0;

    return this.outputNets.map((netId, i) => ({
      netId,
      driverId: `${this.driverId}:d${i}`,
      strength: "strong",
      signal: !enabled
        ? SIGNAL.FLOATING
        : !known
          ? SIGNAL.UNKNOWN
          : (value >> (this.outputNets.length - 1 - i)) & 1
            ? SIGNAL.HIGH
            : SIGNAL.LOW,
    }));
  }

  getMemorySnapshot() {
    return this.contents.map((value) =>
      this.outputNets.map(
        (_, i) => (value >> (this.outputNets.length - 1 - i)) & 1,
      ),
    );
  }
}
