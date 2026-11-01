import { NPNTransistor, PullUpResistor } from "../../simulation/hardware";

export class NORGate {
  constructor(sim, inputA, inputB, output, ground) {
    sim.addComponent(new PullUpResistor(output));

    sim.addComponent(new NPNTransistor(inputA, output, ground));
    sim.addComponent(new NPNTransistor(inputB, output, ground));
  }
}

export class NORGateN {
  constructor(sim, { inputs, output, ground, prefix = "norGateN" }) {
    const suffix = sim.components.length;

    if (!inputs || inputs.length < 2) {
      throw new Error("NORGateN requires at least 2 inputs.");
    }

    if (inputs.length === 2) {
      const [pin1, pin2] = inputs;
      new NORGate(sim, pin1, pin2, output, ground);
      return;
    }

    let currentOutput = inputs[0];

    for (let i = 1; i < inputs.length - 1; i++) {
      const subNet = `${prefix}-sub-${i}-${suffix}`;
      sim.addNet(subNet);

      new NORGate(sim, currentOutput, inputs[i], subNet, ground);
      currentOutput = subNet;
    }

    new NORGate(sim, currentOutput, inputs[inputs.length - 1], output, ground);
  }
}
