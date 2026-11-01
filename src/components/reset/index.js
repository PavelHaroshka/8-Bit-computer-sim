import { ANDGate, NOTGate } from "../gates";

export class Reset {
  constructor(
    sim,
    { reset, stepReset, output, power, ground, prefix = "reset" },
  ) {
    const suffix = sim.components.length;
    const net = (name) => {
      const id = `${prefix}-${name}-${suffix}`;
      sim.addNet(id);
      return id;
    };

    const activeStepReset = stepReset || power;
    const activeReset = reset || ground;

    if (!output) {
      output = net("out");
    }

    const invertedInputs = net("reset-inverted");

    new NOTGate(sim, activeReset, invertedInputs, ground);
    new ANDGate(sim, invertedInputs, activeStepReset, output, power);

    this.outputNet = output;
  }
}
