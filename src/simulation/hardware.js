import { Component } from "./component";
import { SIGNAL } from "./signals";

export class PowerSupply extends Component {
  constructor(output) {
    super({ output });
  }

  eval() {
    return [
      {
        netId: this.terminals.output,
        driverId: this.driverId,
        strength: "strong",
        signal: SIGNAL.HIGH,
      },
    ];
  }
}

export class Ground extends Component {
  constructor(output) {
    super({ output });
  }

  eval() {
    return [
      {
        netId: this.terminals.output,
        driverId: this.driverId,
        strength: "strong",
        signal: SIGNAL.LOW,
      },
    ];
  }
}

export class Switch extends Component {
  constructor(a, b, closed = false) {
    super({ a, b });
    this.closed = closed;
  }

  eval() {
    return null;
  }

  connectionState() {
    return {
      switchId: this.driverId,
      aNetId: this.terminals.a,
      bNetId: this.terminals.b,
      closed: this.closed,
    };
  }

  switches() {
    if (!this.closed) {
      return [];
    }

    return [
      {
        switchId: this.driverId,
        aNetId: this.terminals.a,
        bNetId: this.terminals.b,
      },
    ];
  }
}

export class Button extends Component {
  constructor(input, output) {
    super({ input, output });
    this.isPressed = false;
    this.enabled = true;
  }

  setPressed(value) {
    this.isPressed = value;
  }

  setEnabled(value) {
    this.enabled = value;
  }

  eval(wires) {
    if (!this.enabled) {
      return [];
    }

    const input = wires[this.terminals.input];

    return [
      {
        netId: this.terminals.output,
        driverId: this.driverId,
        strength: "strong",
        signal:
          input === SIGNAL.HIGH && this.isPressed ? SIGNAL.HIGH : SIGNAL.LOW,
      },
    ];
  }
}

export class LED extends Component {
  constructor(input) {
    super({ input });
    this.lit = false;
  }

  eval() {
    return null;
  }

  observe(wires) {
    this.lit = wires[this.terminals.input] === SIGNAL.HIGH;
  }
}

export class NPNTransistor extends Component {
  constructor(base, collector, emitter) {
    super({ base, collector, emitter });
    this.conducting = false;
    this.controlSignal = SIGNAL.FLOATING;
  }

  eval(wires) {
    this.controlSignal = wires[this.terminals.base];
    this.conducting = this.controlSignal === SIGNAL.HIGH;

    return null;
  }

  connectionState() {
    return {
      switchId: this.driverId,
      aNetId: this.terminals.collector,
      bNetId: this.terminals.emitter,
      closed: this.conducting,
    };
  }

  switches() {
    if (!this.conducting) {
      return [];
    }

    return [
      {
        switchId: this.driverId,
        aNetId: this.terminals.collector,
        bNetId: this.terminals.emitter,
      },
    ];
  }
}

export class PullUpResistor extends Component {
  constructor(output, strength = 1) {
    super({ output });
    this.strength = strength;
  }

  eval() {
    return null;
  }

  pulls() {
    return [
      {
        netId: this.terminals.output,
        pullId: this.driverId,
        signal: SIGNAL.HIGH,
        strength: this.strength,
      },
    ];
  }
}

export class PullDownResistor extends Component {
  constructor(output, strength = 1) {
    super({ output });
    this.strength = strength;
  }

  eval() {
    return null;
  }

  pulls() {
    return [
      {
        netId: this.terminals.output,
        pullId: this.driverId,
        signal: SIGNAL.LOW,
        strength: this.strength,
      },
    ];
  }
}

export class Capacitor {
  constructor({
    capacitance,
    initialVoltage = 0,
    targetVoltage = 0,
    resistance = 1000,
    outputNet = null,
  }) {
    if (!Number.isFinite(capacitance) || capacitance <= 0) {
      throw new Error("Capacitance must be greater than zero");
    }

    if (!Number.isFinite(resistance) || resistance <= 0) {
      throw new Error("Resistance must be greater than zero");
    }

    if (!Number.isFinite(initialVoltage)) {
      throw new Error("Initial voltage must be finite");
    }

    if (!Number.isFinite(targetVoltage)) {
      throw new Error("Target voltage must be finite");
    }

    this.capacitance = capacitance;
    this.voltage = initialVoltage;
    this.targetVoltage = targetVoltage;
    this.resistance = resistance;
    this.outputNet = outputNet;
  }

  setTargetVoltage(voltage) {
    if (!Number.isFinite(voltage)) {
      throw new Error("Target voltage must be finite");
    }

    this.targetVoltage = voltage;
  }

  setResistance(resistance) {
    if (!Number.isFinite(resistance) || resistance <= 0) {
      throw new Error("Resistance must be greater than zero");
    }

    this.resistance = resistance;
  }

  advanceTime(dt) {
    if (!Number.isFinite(dt) || dt < 0) {
      throw new Error("Time step must be non-negative");
    }

    const timeConstant = this.resistance * this.capacitance;

    this.voltage =
      this.targetVoltage +
      (this.voltage - this.targetVoltage) * Math.exp(-dt / timeConstant);
  }

  publishVoltage(sim) {
    if (this.outputNet === null) {
      return;
    }

    sim.getNet(this.outputNet).setVoltage(this.voltage);
  }
}

export class ThresholdDetector extends Component {
  constructor(input, output, threshold) {
    super({ input, output });

    if (!Number.isFinite(threshold)) {
      throw new Error("Threshold must be finite");
    }

    this.threshold = threshold;
    this.simulation = null;
  }

  setThreshold(threshold) {
    if (!Number.isFinite(threshold)) {
      throw new Error("Threshold must be finite");
    }

    this.threshold = threshold;
  }

  attachSimulation(simulation) {
    this.simulation = simulation;
  }

  eval() {
    if (!this.simulation) {
      throw new Error("ThresholdDetector is not attached to a Simulation");
    }

    const voltage = this.simulation.getVoltage(this.terminals.input);

    let signal = SIGNAL.UNKNOWN;

    if (voltage !== null) {
      signal = voltage >= this.threshold ? SIGNAL.HIGH : SIGNAL.LOW;
    }

    return [
      {
        netId: this.terminals.output,
        driverId: this.driverId,
        strength: "strong",
        signal,
      },
    ];
  }
}

export class Timer555 extends Component {
  constructor({
    output,
    vcc = 5,
    resistanceA,
    resistanceB,
    capacitance,
    initialOutput = SIGNAL.HIGH,
  }) {
    super({ output });

    if (!Number.isFinite(vcc) || vcc <= 0) {
      throw new Error("VCC must be a finite positive number");
    }

    if (!Number.isFinite(resistanceA) || resistanceA <= 0) {
      throw new Error("Resistance A must be positive");
    }

    if (!Number.isFinite(resistanceB) || resistanceB <= 0) {
      throw new Error("Resistance B must be positive");
    }

    if (!Number.isFinite(capacitance) || capacitance <= 0) {
      throw new Error("Capacitance must be positive");
    }

    if (initialOutput !== SIGNAL.HIGH && initialOutput !== SIGNAL.LOW) {
      throw new Error("Initial output must be HIGH or LOW");
    }

    this.vcc = vcc;
    this.resistanceA = resistanceA;
    this.resistanceB = resistanceB;
    this.capacitance = capacitance;

    this.outputSignal = initialOutput;
    this.elapsed = 0;
  }

  get highDuration() {
    return 0.693 * (this.resistanceA + this.resistanceB) * this.capacitance;
  }

  get lowDuration() {
    return 0.693 * this.resistanceB * this.capacitance;
  }

  advanceTime(dt) {
    if (!Number.isFinite(dt) || dt < 0) {
      throw new Error("Time step must be non-negative");
    }

    this.elapsed += dt;

    while (true) {
      const duration =
        this.outputSignal === SIGNAL.HIGH
          ? this.highDuration
          : this.lowDuration;

      if (!Number.isFinite(duration) || duration <= 0) {
        throw new Error("Timer duration must be finite and positive");
      }

      const tolerance =
        Number.EPSILON * Math.max(Math.abs(this.elapsed), duration) * 8;

      if (this.elapsed < duration - tolerance) {
        break;
      }

      // Consume the duration and transition the output.
      this.elapsed -= duration;

      // Correct tiny negative rounding errors at the boundary.
      if (this.elapsed < 0 && this.elapsed >= -tolerance) {
        this.elapsed = 0;
      }

      this.outputSignal =
        this.outputSignal === SIGNAL.HIGH ? SIGNAL.LOW : SIGNAL.HIGH;
    }
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
