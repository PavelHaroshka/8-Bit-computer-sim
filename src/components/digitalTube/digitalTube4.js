import { Component } from "../../simulation/component";
import { SIGNAL } from "../../simulation/signals";
import { decodeSegments } from "./digitalTube";

export class FourDigitTube extends Component {
  constructor(
    sim,
    { segments, dp, digits, activeLowSelect = false, persistence = Infinity },
  ) {
    if (
      !Array.isArray(segments) ||
      (segments.length !== 7 && segments.length !== 8)
    ) {
      throw new Error(
        "FourDigitTube requires 7 segment nets (a-g), plus an optional dp.",
      );
    }
    if (!Array.isArray(digits) || digits.length !== 4) {
      throw new Error("FourDigitTube requires 4 digit-select nets.");
    }

    const segmentNets = segments.slice(0, 7);
    const dpNet = dp ?? segments[7] ?? null;
    const patternNets = dpNet ? [...segmentNets, dpNet] : segmentNets;

    const terminals = {};
    patternNets.forEach((net, i) => (terminals[`seg${i}`] = net));
    digits.forEach((net, i) => (terminals[`digit${i}`] = net));

    super(terminals);

    this.sim = sim;
    this.patternNets = patternNets;
    this.digitNets = digits;
    this.activeLowSelect = activeLowSelect;
    this.persistence = persistence;

    this.state = digits.map(() => patternNets.map(() => 0));
    this.updatedAt = digits.map(() => -Infinity);

    sim.addComponent(this);
  }

  eval() {
    return null;
  }

  observe(wires) {
    const active = this.activeLowSelect ? SIGNAL.LOW : SIGNAL.HIGH;

    const pattern = this.patternNets.map((net) => {
      const signal = wires[net];

      if (signal === SIGNAL.HIGH) return 1;
      if (signal === SIGNAL.LOW) return 0;

      return null;
    });

    this.digitNets.forEach((net, i) => {
      if (wires[net] === active) {
        this.state[i] = [...pattern];
        this.updatedAt[i] = this.sim.time;
      }
    });
  }

  getDigits() {
    return this.state.map((bits, i) =>
      this.sim.time - this.updatedAt[i] <= this.persistence
        ? [...bits]
        : bits.map(() => 0),
    );
  }

  getMemorySnapshot() {
    return this.getDigits();
  }

  get lit() {
    return this.getDigits().map((bits) => bits.map((bit) => bit === 1));
  }

  getSelected() {
    const active = this.activeLowSelect ? SIGNAL.LOW : SIGNAL.HIGH;
    return this.digitNets.map((net) => this.sim.getSignal(net) === active);
  }

  getText() {
    return this.getDigits()
      .map((bits) => decodeSegments(bits))
      .join("");
  }
}
