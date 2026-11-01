import { NORGate } from "../gates";
import { SIGNAL } from "../../simulation/signals";

export class SRLatch {
  constructor(sim, { set, reset, q, qBar, ground, initialState = SIGNAL.LOW }) {
    this.sim = sim;
    this.q = q;
    this.qBar = qBar;

    sim.setInitialSignal(q, initialState);
    sim.setInitialSignal(
      qBar,
      initialState === SIGNAL.HIGH ? SIGNAL.LOW : SIGNAL.HIGH,
    );

    // Q = NOR(reset, Q̅)
    new NORGate(sim, reset, qBar, q, ground, { delay: 1 });

    // Q̅ = NOR(set, Q)
    new NORGate(sim, set, q, qBar, ground, { delay: 2 });
  }
}
