import { SIGNAL } from "../../simulation/signals";
import { NOTGate } from "../gates";
import { DLatch } from "./DLatch";

export class DFlipFlop {
  constructor(
    sim,
    {
      data,
      clock,
      q,
      qBar,
      power,
      ground,
      initialState = SIGNAL.LOW,
      prefix = "dFlipFlop",
    },
  ) {
    const invertedClock = `${prefix}_invertedClock`;
    const masterQ = `${prefix}_masterQ`;
    const masterQBar = `${prefix}_masterQBar`;
    const actualQBar = qBar || `${prefix}_internalQBar`;

    const inverseState =
      initialState === SIGNAL.HIGH ? SIGNAL.LOW : SIGNAL.HIGH;

    sim.addNet(invertedClock);
    sim.addNet(masterQ);
    sim.addNet(masterQBar);

    if (!qBar) {
      sim.addNet(actualQBar);
    }

    // Initialize both latch outputs consistently.
    sim.setInitialSignal(masterQ, initialState);
    sim.setInitialSignal(masterQBar, inverseState);
    sim.setInitialSignal(q, initialState);
    sim.setInitialSignal(actualQBar, inverseState);

    new NOTGate(sim, clock, invertedClock, ground);

    new DLatch(sim, {
      data,
      enable: invertedClock,
      q: masterQ,
      qBar: masterQBar,
      power,
      ground,
      initialState,
      prefix: `${prefix}_master`,
    });

    new DLatch(sim, {
      data: masterQ,
      enable: clock,
      q,
      qBar: actualQBar,
      power,
      ground,
      initialState,
      prefix: `${prefix}_slave`,
    });
  }
}
