import { NPNTransistor, PullDownResistor } from "../../simulation/hardware";

export class ORGate {
  constructor(sim, inputA, inputB, output, power) {
    sim.addComponent(new NPNTransistor(inputA, output, power));
    sim.addComponent(new NPNTransistor(inputB, output, power));

    sim.addComponent(new PullDownResistor(output));
  }
}
