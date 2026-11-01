import { NOTGate } from "../gates";
import { SyncCounter4Bit } from "../progrmCounter";
import { BinaryDecoder } from "../progrmCounter/binaryDecoder";
import { ROM } from "../rom";
import { buildMicrocodeContents } from "../rom/microcodeRom";

export class CPUModule {
  constructor(
    sim,
    {
      controls,
      romEnable,
      instructionAddress,
      clock,
      clearLow,
      power,
      ground,
      flags = [],
      prefix = "cpu",
    },
  ) {
    const suffix = sim.components.length;
    const nets = {
      invertedClock: `${prefix}-clk-${suffix}`,
    };

    Object.values(nets).forEach((net) => sim.addNet(net));

    const net = (name) => {
      const id = `${prefix}-${name}-${suffix}`;
      sim.addNet(id);
      return id;
    };

    const counterOut = new Array(4)
      .fill(0)
      .map((_, idx) => net(`counter-out-${idx}`));

    const decoderOut = new Array(8)
      .fill(0)
      .map((_, idx) => net(`decoder-out-${idx}`));

    new NOTGate(sim, clock, nets.invertedClock, ground);

    new SyncCounter4Bit(sim, {
      clock: nets.invertedClock,
      data: new Array(4).fill(ground),
      clear: clearLow ?? power,
      load: decoderOut[4],
      enableP: power,
      enableT: power,
      output: counterOut,
      power,
      ground,
    });

    new BinaryDecoder(sim, {
      inputs: counterOut.slice(0, 3),
      outputs: decoderOut,
      g1: power,
      g2a: ground,
      g2b: ground,
      ground,
      power,
    });

    const romAddress = [
      ...counterOut.slice(0, 3),
      ...instructionAddress,
      ...flags,
    ];

    const microcode = buildMicrocodeContents();

    new ROM(sim, {
      address: romAddress,
      output: controls,
      outputEnable: romEnable,
      contents: microcode,
    });

    this.stepDecoderOutputs = decoderOut;
    this.counterOutputs = counterOut;
  }
}
