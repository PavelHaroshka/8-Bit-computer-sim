import { Register } from "./Register";

export class RegisterNBit {
  constructor(
    sim,
    {
      dataPins,
      load,
      outputEnable,
      clock,
      outputPins,
      clearLow,
      power,
      ground,
      prefix = "reg",
      bitWidth = 8,
    },
  ) {
    if (!Number.isInteger(bitWidth) || bitWidth < 1) {
      throw new Error("Register requires a positive integer bitWidth.");
    }

    if (!Array.isArray(dataPins) || dataPins.length !== bitWidth) {
      throw new Error(`Register requires an array of ${bitWidth} data pins.`);
    }

    if (!Array.isArray(outputPins) || outputPins.length !== bitWidth) {
      throw new Error(`Register requires an array of ${bitWidth} output pins.`);
    }

    this.stateNets = [];

    for (let i = 0; i < bitWidth; i++) {
      const reg = new Register(sim, {
        data: dataPins[i],
        load,
        outputEnable,
        clock,
        output: outputPins[i],
        clearLow,
        power,
        ground,
        prefix: `${prefix}_bit_${i}`,
      });

      this.stateNets.push(reg.flopOut);
    }
  }
}
