import {
  NPNTransistor,
  PullDownResistor,
  PullUpResistor,
} from "../../simulation/hardware";

export class XORGate {
  constructor(sim, inputA, inputB, output, power, ground) {
    const suffix = sim.components.length;

    const nets = {
      notA: `xor-notA-${suffix}`,
      notB: `xor-notB-${suffix}`,
      middleA: `xor-middleA-${suffix}`,
      middleB: `xor-middleB-${suffix}`,
      outA: `xor-outA-${suffix}`,
      outB: `xor-outB-${suffix}`,
    };

    Object.values(nets).forEach((net) => sim.addNet(net));

    // NOT A
    sim.addComponent(new PullUpResistor(nets.notA));
    sim.addComponent(new NPNTransistor(inputA, nets.notA, ground));

    // NOT B
    sim.addComponent(new PullUpResistor(nets.notB));
    sim.addComponent(new NPNTransistor(inputB, nets.notB, ground));

    // AND path 1: A AND NOT B
    sim.addComponent(new NPNTransistor(inputA, power, nets.middleA));
    sim.addComponent(new NPNTransistor(nets.notB, nets.middleA, nets.outA));
    sim.addComponent(new PullDownResistor(nets.outA));

    // AND path 2: NOT A AND B
    sim.addComponent(new NPNTransistor(nets.notA, power, nets.middleB));
    sim.addComponent(new NPNTransistor(inputB, nets.middleB, nets.outB));
    sim.addComponent(new PullDownResistor(nets.outB));

    // OR: path1 OR path2
    sim.addComponent(new NPNTransistor(nets.outA, power, output));
    sim.addComponent(new NPNTransistor(nets.outB, power, output));
    sim.addComponent(new PullDownResistor(output));
  }
}
