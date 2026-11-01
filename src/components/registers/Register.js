import { SIGNAL } from "../../simulation/signals";
import { TriStateBuffer } from "../buffers";
import { NOTGate, ANDGate, ORGate } from "../gates";
import { MSJKFlipFlop } from "../latches";

export class Register {
  constructor(
    sim,
    {
      data,
      load,
      outputEnable,
      clock,
      output,
      clearLow,
      power,
      ground,
      initialState = SIGNAL.LOW,
      prefix = "register",
    },
  ) {
    this.sim = sim;
    const suffix = sim.components.length;

    const nets = {
      loadNotOut: `${prefix}-not-out-${suffix}`,
      loadAndOut: `${prefix}-load-and-out-${suffix}`,
      dataAndOut: `${prefix}-data-and-out-${suffix}`,
      orOut: `${prefix}-or-out-${suffix}`,
      flopOut: `${prefix}-flop-${suffix}`,
      flopOutBar: `${prefix}-flop-bar-${suffix}`,
      flopDataBar: `${prefix}-data-bar-${suffix}`,
    };

    Object.values(nets).forEach((net) => sim.addNet(net));

    this.flopOut = nets.flopOut;

    new NOTGate(sim, load, nets.loadNotOut, ground);
    new ANDGate(sim, nets.loadNotOut, nets.flopOut, nets.loadAndOut, power);
    new ANDGate(sim, load, data, nets.dataAndOut, power);
    new ORGate(sim, nets.loadAndOut, nets.dataAndOut, nets.orOut, power);

    let flopData = nets.orOut;

    if (clearLow) {
      flopData = `${prefix}-clr-${suffix}`;
      sim.addNet(flopData);
      new ANDGate(sim, nets.orOut, clearLow, flopData, power);
    }

    new NOTGate(sim, flopData, nets.flopDataBar, ground);

    this.dff = new MSJKFlipFlop(sim, {
      j: flopData,
      k: nets.flopDataBar,
      clock,
      q: nets.flopOut,
      qBar: nets.flopOutBar,
      initialState,
      power,
      ground,
      prefix: `${prefix}_jk_${suffix}`,
    });

    new TriStateBuffer(sim, nets.flopOut, outputEnable, output);
  }
}
