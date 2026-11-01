import { SIGNAL } from "./signals";

export class Net {
  constructor(id, { retainCharge = false } = {}) {
    this.id = id;
    this.signal = SIGNAL.FLOATING;
    this.retainCharge = retainCharge;
    this.voltage = null;
    this.drivers = new Map();
    this.pulls = new Map();
  }

  resolve() {
    const strong = [...this.drivers.values()];

    if (strong.length > 0) {
      this.signal = this.resolveSignals(strong);
      return this.signal;
    }

    const pulls = [...this.pulls.values()];
    const max = Math.max(...pulls.map((p) => p.strength));
    this.signal = this.resolveSignals(
      pulls.filter((p) => p.strength === max).map((p) => p.signal),
    );
    return this.signal;
  }

  resolveSignals(signals) {
    if (signals.length === 0) {
      return SIGNAL.FLOATING;
    }

    if (signals.includes(SIGNAL.UNKNOWN)) {
      return SIGNAL.UNKNOWN;
    }

    const hasHigh = signals.includes(SIGNAL.HIGH);
    const hasLow = signals.includes(SIGNAL.LOW);

    if (hasHigh && hasLow) {
      return SIGNAL.UNKNOWN;
    }

    if (hasHigh) return SIGNAL.HIGH;
    if (hasLow) return SIGNAL.LOW;

    return SIGNAL.FLOATING;
  }

  setVoltage(voltage) {
    if (voltage !== null && !Number.isFinite(voltage)) {
      throw new Error(`Invalid voltage for net "${this.id}": ${voltage}`);
    }

    this.voltage = voltage;
  }
}
