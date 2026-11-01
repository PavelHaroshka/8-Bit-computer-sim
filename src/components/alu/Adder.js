import { ANDGate, ORGate, XORGate } from "../gates";

export class FullAdder {
  constructor(
    sim,
    {
      inputA,
      inputB,
      carryIn,
      carryOut,
      sumOut,
      power,
      ground,
      prefix = "full-adder",
    },
  ) {
    const suffix = sim.components.length;
    const nets = {
      xor1: `${prefix}-xor1-${suffix}`,
      and1: `${prefix}-and1-${suffix}`,
      and2: `${prefix}-and2-${suffix}`,
    };

    Object.values(nets).forEach((net) => sim.addNet(net));

    new XORGate(sim, inputA, inputB, nets.xor1, power, ground);
    new ANDGate(sim, inputA, inputB, nets.and1, power);

    new XORGate(sim, nets.xor1, carryIn, sumOut, power, ground);
    new ANDGate(sim, nets.xor1, carryIn, nets.and2, power);

    new ORGate(sim, nets.and1, nets.and2, carryOut, power);
  }
}

export class BinaryAdder4Bit {
  constructor(
    sim,
    {
      inputAPins,
      inputBPins,
      outputPins,
      carryIn,
      carryOut,
      power,
      ground,
      prefix = "add4",
    },
  ) {
    if (!Array.isArray(inputAPins) || inputAPins.length !== 4) {
      throw new Error("BinaryAdder4Bit requires an array of 4 input A pins.");
    }
    if (!Array.isArray(inputBPins) || inputBPins.length !== 4) {
      throw new Error("BinaryAdder4Bit requires an array of 4 input B pins.");
    }
    if (!Array.isArray(outputPins) || outputPins.length !== 4) {
      throw new Error("BinaryAdder4Bit requires an array of 4 output pins.");
    }
    if (!carryIn) {
      throw new Error("BinaryAdder4Bit requires a carryIn net.");
    }

    const suffix = sim.components.length;
    const carries = [carryIn];

    for (let i = 1; i < 4; i++) {
      const netId = `${prefix}_carry_${i}_${suffix}`;
      sim.addNet(netId);
      carries.push(netId);
    }

    if (!carryOut) {
      carryOut = `${prefix}_carry_out_${suffix}`;
      sim.addNet(carryOut);
    }
    carries.push(carryOut);

    for (let i = 0; i < 4; i++) {
      new FullAdder(sim, {
        inputA: inputAPins[i],
        inputB: inputBPins[i],
        carryIn: carries[i],
        carryOut: carries[i + 1],
        sumOut: outputPins[i],
        power,
        ground,
        prefix: `${prefix}_bit_${i}`,
      });
    }
  }
}
