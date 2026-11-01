import { Component } from "../../simulation/component";
import { Capacitor } from "../../simulation/hardware";
import { SIGNAL } from "../../simulation/signals";

export const CLOCK_MODE = { AUTO: "auto", MANUAL: "manual" };

class ClockController extends Component {
  constructor(
    inputNet,
    outputNet,
    capacitor,
    upperThreshold,
    lowerThreshold,
    haltNet = null,
    resetNet = null,
  ) {
    super({ input: inputNet, output: outputNet });
    this.capacitor = capacitor;
    this.upperThreshold = upperThreshold;
    this.lowerThreshold = lowerThreshold;
    this.haltNet = haltNet;
    this.resetNet = resetNet;
    this.outputSignal = SIGNAL.HIGH;

    this.mode = CLOCK_MODE.AUTO;
    this.pulseTicksLeft = 0;
    this.pulsePromise = null;
    this.pulseResolve = null;
  }

  isHalted() {
    if (!this.haltNet || !this.simulation) return false;

    if (
      this.resetNet &&
      this.simulation.getSignal(this.resetNet) === SIGNAL.HIGH
    ) {
      return false;
    }
    return this.simulation.getSignal(this.haltNet) === SIGNAL.HIGH;
  }

  advanceTime(dt) {
    if (!this.simulation) return;

    if (this.mode === CLOCK_MODE.MANUAL) {
      if (this.pulseTicksLeft > 0 && --this.pulseTicksLeft === 0) {
        this.outputSignal = SIGNAL.LOW;
        this.#finishPulse();
      }
      return;
    }

    if (this.outputSignal === SIGNAL.LOW && this.isHalted()) return;
    const voltage = this.simulation.getVoltage(this.terminals.input) ?? 0;

    if (voltage >= this.upperThreshold) {
      this.outputSignal = SIGNAL.LOW;
      this.capacitor.setTargetVoltage(0);
    } else if (voltage <= this.lowerThreshold) {
      this.outputSignal = SIGNAL.HIGH;
      this.capacitor.setTargetVoltage(5);
    }
  }

  setMode(mode) {
    if (mode === this.mode) return;
    this.mode = mode;

    if (mode === CLOCK_MODE.MANUAL) {
      this.outputSignal = SIGNAL.LOW;
      this.pulseTicksLeft = 0;
    } else {
      this.pulseTicksLeft = 0;
      this.#finishPulse();
      this.capacitor.setTargetVoltage(
        this.outputSignal === SIGNAL.HIGH ? 5 : 0,
      );
    }
  }

  setLevel(level) {
    if (this.mode !== CLOCK_MODE.MANUAL) return;
    this.outputSignal = level;
  }

  pulse(highTicks = 5) {
    if (this.mode !== CLOCK_MODE.MANUAL) return Promise.resolve();
    if (this.isHalted()) return Promise.resolve();
    if (this.pulsePromise) return this.pulsePromise;

    this.outputSignal = SIGNAL.HIGH;
    this.pulseTicksLeft = highTicks;
    this.pulsePromise = new Promise((resolve) => (this.pulseResolve = resolve));
    return this.pulsePromise;
  }

  #finishPulse() {
    this.pulseResolve?.();
    this.pulseResolve = null;
    this.pulsePromise = null;
  }

  attachSimulation(simulation) {
    this.simulation = simulation;
  }

  eval() {
    return [
      {
        netId: this.terminals.output,
        driverId: this.driverId,
        strength: "strong",
        signal: this.outputSignal,
      },
    ];
  }
}

export class ClockModule {
  constructor(sim, outputNet, options = {}) {
    const {
      capacitance = 0.000005, // 5 µF
      resistance = 10000, // 10 kΩ
      upperThreshold = 3.5, // ~2/3 VCC
      lowerThreshold = 1.5, // ~1/3 VCC
      mode = CLOCK_MODE.AUTO,
      haltNet = null, // while HIGH the clock stops (LOW)
      resetNet = null, // while HIGH, halt is ignored
    } = options;

    if (!sim.nets.has(outputNet)) sim.addNet(outputNet);

    const capVoltageNet = `clock-cap-${sim.components.length}`;
    sim.addNet(capVoltageNet);

    this.capacitor = new Capacitor({
      capacitance,
      initialVoltage: 0,
      targetVoltage: 5,
      resistance,
      outputNet: capVoltageNet,
    });
    sim.addTimedComponent(this.capacitor);

    this.controller = new ClockController(
      capVoltageNet,
      outputNet,
      this.capacitor,
      upperThreshold,
      lowerThreshold,
      haltNet,
      resetNet,
    );
    sim.addTimedComponent(this.controller);

    this.setMode(mode);
  }

  get mode() {
    return this.controller.mode;
  }
  get halted() {
    return this.controller.isHalted();
  }
  setMode(mode) {
    this.controller.setMode(mode);
  }
  setLevel(level) {
    this.controller.setLevel(level);
  }
  pulse(highTicks) {
    return this.controller.pulse(highTicks);
  }
}
