import { ANDGate } from "../gates/andGate";
import { NOTGate } from "../gates/notGate";

export class BinaryDecoder {
  constructor(
    sim,
    { inputs, g1, g2a, g2b, outputs, power, ground, prefix = "ls138" },
  ) {
    if (!Array.isArray(inputs) || inputs.length !== 3) {
      throw new Error("BinaryDecoder requires 3 input pins [A, B, C].");
    }
    if (!Array.isArray(outputs) || outputs.length !== 8) {
      throw new Error("BinaryDecoder requires 8 output pins [Y0..Y7].");
    }

    const suffix = sim.components.length;
    const net = (name) => {
      const id = `${prefix}-${name}-${suffix}`;
      sim.addNet(id);
      return id;
    };

    const activeG1 = g1 || power;
    const activeG2a = g2a || ground;
    const activeG2b = g2b || ground;

    const ng2a = net("ng2a");
    const ng2b = net("ng2b");
    const en1 = net("en-1");
    const enabled = net("enabled");

    new NOTGate(sim, activeG2a, ng2a, ground);
    new NOTGate(sim, activeG2b, ng2b, ground);
    new ANDGate(sim, activeG1, ng2a, en1, power);
    new ANDGate(sim, en1, ng2b, enabled, power);

    const na = net("na");
    const nb = net("nb");
    const nc = net("nc");

    new NOTGate(sim, inputs[0], na, ground); // ~A
    new NOTGate(sim, inputs[1], nb, ground); // ~B
    new NOTGate(sim, inputs[2], nc, ground); // ~C

    for (let i = 0; i < 8; i++) {
      const litC = i & 4 ? inputs[2] : nc;
      const litB = i & 2 ? inputs[1] : nb;
      const litA = i & 1 ? inputs[0] : na;

      const step1 = net(`step1-${i}`);
      const step2 = net(`step2-${i}`);
      const activeHigh = net(`ah-${i}`);

      new ANDGate(sim, enabled, litC, step1, power);
      new ANDGate(sim, step1, litB, step2, power);
      new ANDGate(sim, step2, litA, activeHigh, power);

      new NOTGate(sim, activeHigh, outputs[i], ground);
    }

    this.outputNets = outputs;
  }
}
