import { NPNTransistor } from "../../simulation/hardware";

export class TriStateBuffer {
  constructor(sim, data, enable, output) {
    sim.addComponent(new NPNTransistor(enable, data, output));
  }
}
