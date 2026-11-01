import { NPNTransistor, PullDownResistor } from "../../simulation/hardware";

export class ANDGate {
  constructor(sim, inputA, inputB, output, power, { delay = 0 } = {}) {
    this.outputDelay = delay;
    const middle = `and-middle-${sim.components.length}`;

    sim.addNet(middle);

    sim.addComponent(new NPNTransistor(inputA, power, middle));
    sim.addComponent(new NPNTransistor(inputB, middle, output));
    sim.addComponent(new PullDownResistor(output));
  }
}

export class ANDGateN {
  constructor(sim, { inputs, output, power, prefix = "andGateN" }) {
    const suffix = sim.components.length;

    if (!inputs || inputs.length < 2) {
      throw new Error("ANDGateN requires at least 2 inputs.");
    }

    if (inputs.length === 2) {
      const [pin1, pin2] = inputs;
      new ANDGate(sim, pin1, pin2, output, power);
      return;
    }

    let currentOutput = inputs[0];

    for (let i = 1; i < inputs.length - 1; i++) {
      const subNet = `${prefix}-sub-${i}-${suffix}`;
      sim.addNet(subNet);

      new ANDGate(sim, currentOutput, inputs[i], subNet, power);
      currentOutput = subNet;
    }

    new ANDGate(sim, currentOutput, inputs[inputs.length - 1], output, power);
  }
}
