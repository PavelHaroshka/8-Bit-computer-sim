import { NPNTransistor, PullUpResistor } from "../../simulation/hardware";

export class NOTGate {
  constructor(sim, input, output, ground) {
    sim.addComponent(new PullUpResistor(output));
    sim.addComponent(new NPNTransistor(input, output, ground));
  }
}
