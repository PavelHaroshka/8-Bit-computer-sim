import { ANDGate } from "../gates/andGate";
import { NOTGate } from "../gates/notGate";
import { ORGate } from "../gates/orGate";
import { XORGate } from "../gates/xorGate";
import { MSJKFlipFlop } from "../latches/MSJKFlipFlop";

export class SyncCounter4Bit {
  constructor(
    sim,
    {
      clock,
      data,
      clear,
      load,
      enableP,
      enableT,
      carry,
      output,
      power,
      ground,
      prefix = "syncCounter4",
    },
  ) {
    if (!Array.isArray(data) || data.length !== 4) {
      throw new Error("SyncCounter4Bit requires 4 data pins.");
    }
    if (!Array.isArray(output) || output.length !== 4) {
      throw new Error("SyncCounter4Bit requires 4 output pins.");
    }

    const suffix = sim.components.length;
    const net = (name) => {
      const id = `${prefix}-${name}-${suffix}`;
      sim.addNet(id);
      return id;
    };

    const enable = net("enable");
    new ANDGate(sim, enableP, enableT, enable, power);

    const loadActive = net("load-active");
    new NOTGate(sim, load, loadActive, ground);

    const toggle = [enable];
    for (let i = 1; i < 4; i++) {
      const t = net(`toggle-${i}`);
      new ANDGate(sim, toggle[i - 1], output[i - 1], t, power);
      toggle.push(t);
    }

    for (let i = 0; i < 4; i++) {
      const next = net(`next-${i}`);
      const loaded = net(`loaded-${i}`);
      const counted = net(`counted-${i}`);
      const chosen = net(`chosen-${i}`);
      const d = net(`d-${i}`);
      const dBar = net(`d-bar-${i}`);
      const qBar = net(`q-bar-${i}`);

      new XORGate(sim, output[i], toggle[i], next, power, ground);
      new ANDGate(sim, loadActive, data[i], loaded, power);
      new ANDGate(sim, load, next, counted, power);
      new ORGate(sim, loaded, counted, chosen, power);
      new ANDGate(sim, clear, chosen, d, power);

      new NOTGate(sim, d, dBar, ground);

      new MSJKFlipFlop(sim, {
        j: d,
        k: dBar,
        clock,
        q: output[i],
        qBar,
        power,
        ground,
        prefix: `${prefix}-jk-${i}-${suffix}`,
      });
    }

    if (!carry) carry = net("carry");
    const lowHalf = net("carry-low-half");
    const highHalf = net("carry-high-half");
    const allHigh = net("carry-all-high");
    new ANDGate(sim, output[0], output[1], lowHalf, power);
    new ANDGate(sim, output[2], output[3], highHalf, power);
    new ANDGate(sim, lowHalf, highHalf, allHigh, power);
    new ANDGate(sim, enableT, allHigh, carry, power);

    this.outputNets = output;
    this.carryNet = carry;
  }
}
