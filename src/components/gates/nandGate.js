import { NPNTransistor, PullUpResistor } from "../../simulation/hardware";

export class NANDGate {
  constructor(sim, inputA, inputB, output, ground, { delay = 0 } = {}) {
    this.outputDelay = delay;
    const middle = `nand-middle-${sim.components.length}`;

    sim.addNet(middle);

    sim.addComponent(new PullUpResistor(output));
    sim.addComponent(new NPNTransistor(inputA, output, middle));
    sim.addComponent(new NPNTransistor(inputB, middle, ground));
  }
}
