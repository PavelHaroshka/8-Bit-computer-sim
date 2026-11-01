import { ANDGate, NOTGate } from "../gates";
import { SRLatch } from "./SRLatch";
import { SIGNAL } from "../../simulation/signals";

export class DLatch {
  constructor(
    sim,
    {
      data,
      enable,
      q,
      qBar,
      power,
      ground,
      initialState = SIGNAL.LOW,
      prefix = "dLatch",
    },
  ) {
    const notData = `${prefix}_notData`;
    const set = `${prefix}_set`;
    const reset = `${prefix}_reset`;
    const actualQBar = qBar || `${prefix}_internalQBar`;

    sim.addNet(notData);
    sim.addNet(set);
    sim.addNet(reset);

    if (!qBar) {
      sim.addNet(actualQBar);
    }

    new NOTGate(sim, data, notData, ground);
    new ANDGate(sim, data, enable, set, power);
    new ANDGate(sim, notData, enable, reset, power);

    new SRLatch(sim, {
      set,
      reset,
      q,
      qBar: actualQBar,
      ground,
      initialState,
    });
  }
}
