import { TriStateBuffer } from "../buffers";
import { XORGate } from "../gates";
import { BinaryAdder4Bit } from "./Adder";

export class ALU {
  constructor(
    sim,
    {
      enableOut,
      enableSub,
      inputA,
      inputB,
      output,
      power,
      ground,
      prefix = "alu",
    },
  ) {
    for (const [name, pins] of [
      ["input A", inputA],
      ["input B", inputB],
      ["output", output],
    ]) {
      if (!Array.isArray(pins) || pins.length !== 8) {
        throw new Error(`ALU requires an array of 8 ${name} pins.`);
      }
    }

    const suffix = sim.components.length;
    const nets = {
      carryMiddle: `${prefix}-carry-middle-${suffix}`,
      carryOutNet: `${prefix}-carry-out-${suffix}`,
    };

    const invertedB = [];
    const sumNets = [];

    for (let i = 0; i < 8; i++) {
      const invertedNet = `${prefix}-inverted-b-${i}-net-${suffix}`;
      sim.addNet(invertedNet);
      new XORGate(sim, inputB[i], enableSub, invertedNet, power, ground);
      invertedB.push(invertedNet);

      const sumNet = `${prefix}-sum-${i}-net-${suffix}`;
      sim.addNet(sumNet);
      new TriStateBuffer(sim, sumNet, enableOut, output[i]);
      sumNets.push(sumNet);
    }

    sim.addNet(nets.carryMiddle);
    sim.addNet(nets.carryOutNet);

    new BinaryAdder4Bit(sim, {
      inputAPins: inputA.slice(0, 4),
      inputBPins: invertedB.slice(0, 4),
      outputPins: sumNets.slice(0, 4),
      carryIn: enableSub,
      carryOut: nets.carryMiddle,
      power,
      ground,
    });

    new BinaryAdder4Bit(sim, {
      inputAPins: inputA.slice(4, 8),
      inputBPins: invertedB.slice(4, 8),
      outputPins: sumNets.slice(4, 8),
      carryIn: nets.carryMiddle,
      carryOut: nets.carryOutNet,
      power,
      ground,
    });

    this.sumNets = sumNets;
    this.invertedBNets = invertedB;
    this.carryOutNet = nets.carryOutNet;
  }
}
