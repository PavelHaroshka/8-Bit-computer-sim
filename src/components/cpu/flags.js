import { NOTGate, ORGate } from "../gates";
import { RegisterNBit } from "../registers";

export class FlagsModule {
  constructor(
    sim,
    { sum, carry, load, clock, clearLow, power, ground, prefix = "flags" },
  ) {
    const suffix = sim.components.length;
    const net = (name) => {
      const id = `${prefix}-${name}-${suffix}`;
      sim.addNet(id);
      return id;
    };

    let layer = sum;
    let n = 0;
    while (layer.length > 1) {
      const next = [];
      for (let i = 0; i < layer.length; i += 2) {
        if (i + 1 === layer.length) {
          next.push(layer[i]);
          continue;
        }
        const out = net(`or-${n++}`);
        new ORGate(sim, layer[i], layer[i + 1], out, power);
        next.push(out);
      }
      layer = next;
    }

    const zero = net("zero-in");
    new NOTGate(sim, layer[0], zero, ground);
    const dataPins = [carry, zero, sum[sum.length - 1], ground];
    const unusedOut = [0, 1, 2, 3].map((i) => net(`nc-${i}`));

    this.register = new RegisterNBit(sim, {
      dataPins,
      load,
      outputEnable: ground,
      clock,
      outputPins: unusedOut,
      clearLow,
      power,
      ground,
      bitWidth: 4,
      prefix,
    });

    this.stateNets = this.register.stateNets;
    this.carryNet = this.stateNets[0];
    this.zeroNet = this.stateNets[1];
    this.negativeNet = this.stateNets[2];
  }
}
