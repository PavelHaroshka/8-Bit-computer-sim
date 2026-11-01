import { TriStateBuffer } from "../buffers/TriStateBuffer";
import { NOTGate } from "../gates/notGate";
import { SyncCounter4Bit } from "./SyncCounter4Bit";

export class ProgramCounter {
  constructor(
    sim,
    {
      bus,
      clock,
      counterEnable,
      counterOut,
      jump,
      clearLow,
      power,
      ground,
      prefix = "pc",
    },
  ) {
    if (!Array.isArray(bus) || bus.length !== 4) {
      throw new Error("ProgramCounter requires 4 bus pins (bit 0 first).");
    }

    const suffix = sim.components.length;
    const net = (name) => {
      const id = `${prefix}-${name}-${suffix}`;
      sim.addNet(id);
      return id;
    };

    const loadLow = net("load-low");
    new NOTGate(sim, jump, loadLow, ground);

    const state = [0, 1, 2, 3].map((i) => net(`q-${i}`));
    const carry = net("carry");

    new SyncCounter4Bit(sim, {
      clock,
      data: bus,
      clear: clearLow ?? power,
      load: loadLow,
      enableP: counterEnable,
      enableT: counterEnable,
      carry,
      output: state,
      power,
      ground,
      prefix: `${prefix}-counter`,
    });

    state.forEach((q, i) => new TriStateBuffer(sim, q, counterOut, bus[i]));

    this.stateNets = state;
    this.carryNet = carry;
  }
}
