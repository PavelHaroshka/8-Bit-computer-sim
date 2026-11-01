import { setupControls } from "./controls";

import {
  Button,
  Ground,
  LED,
  PowerSupply,
  PullDownResistor,
} from "./simulation/hardware";
import { SIGNAL } from "./simulation/signals";
import { Simulation } from "./simulation/simulation";
import {
  TriStateBuffer,
  ClockModule,
  CLOCK_MODE,
  RegisterNBit,
  ALU,
  AddressRegister,
  RAM16bytes,
  ProgramCounter,
  DisplayModule,
  CPUModule,
  FlagsModule,
} from "./components";
import { Reset } from "./components/reset";
import { ORGate } from "./components/gates";
import { program } from "./components/asm";

export const NETS = {
  POWER: "vcc",
  GROUND: "gnd",
  CLOCK: "clk",
  LOAD_A: "load_a",
  OE_A: "oe_a",
  LOAD_B: "load_b",
  OE_B: "oe_b",
  LOAD_IR: "load_ir",
  OE_IR: "oe_ir",
  OE_IN: "oe_in",
  OE_ALU: "oe_alu",
  SUB: "alu_sub",
  LOAD_RAM: "load_ram",
  OE_RAM: "oe_ram",
  LOAD_MAR: "load_mar",
  LOAD_PC: "load_pc",
  OE_PC: "oe_pc",
  PC_ENABLE: "pc_enable",
  LOAD_OUT: "load_out",
  DISPLAY_SIGNED: "display_signed",
  CPU_AUTO: "cpu_auto",
  RESET: "reset",
  RESET_N: "reset_n",
  HALT_BTN: "halt_btn",
  HALT_ROM: "halt_rom",
  HALT: "halt",
  LOAD_FLAGS: "load_flags",
  FLAGS_IN: "flags_in",
};

export const BUS_PINS = Array.from({ length: 8 }, (_, i) => `bus_${i}`);
export const IN_PINS = Array.from({ length: 8 }, (_, i) => `in_${i}`);
export const MAR_OUTPUT_PINS = Array.from(
  { length: 4 },
  (_, i) => `mar_out_${i}`,
);
export const RAM_ADDR_PINS = Array.from(
  { length: 4 },
  (_, i) => `ram_addr_${i}`,
);

export class HardwareSimulation {
  constructor() {
    this.sim = new Simulation();

    Object.values(NETS).forEach((net) => this.sim.addNet(net));
    BUS_PINS.forEach((pin) => this.sim.addNet(pin));
    IN_PINS.forEach((pin) => this.sim.addNet(pin));
    MAR_OUTPUT_PINS.forEach((pin) => this.sim.addNet(pin));
    RAM_ADDR_PINS.forEach((pin) => this.sim.addNet(pin));

    this.sim.addComponent(new PowerSupply(NETS.POWER));
    this.sim.addComponent(new Ground(NETS.GROUND));

    this.sim.addComponent(new PullDownResistor(NETS.CPU_AUTO));
    this.sim.addComponent(new PullDownResistor(NETS.CLOCK));
    BUS_PINS.forEach((pin) =>
      this.sim.addComponent(new PullDownResistor(pin, 0.5)),
    );
    Object.values(NETS)
      .filter(
        (net) =>
          net.startsWith("load_") ||
          net.startsWith("oe_") ||
          net === NETS.SUB ||
          net === NETS.PC_ENABLE ||
          net === NETS.DISPLAY_SIGNED,
      )
      .forEach((net) => this.sim.addComponent(new PullDownResistor(net)));

    [NETS.RESET, NETS.HALT_BTN, NETS.HALT_ROM].forEach((net) =>
      this.sim.addComponent(new PullDownResistor(net)),
    );

    new Reset(this.sim, {
      reset: NETS.RESET,
      output: NETS.RESET_N,
      power: NETS.POWER,
      ground: NETS.GROUND,
    });

    new ORGate(this.sim, NETS.HALT_BTN, NETS.HALT_ROM, NETS.HALT, NETS.POWER);

    this.clock = new ClockModule(this.sim, NETS.CLOCK, {
      capacitance: 0.000005,
      resistance: 1000,
      mode: CLOCK_MODE.MANUAL,
      haltNet: NETS.HALT,
      resetNet: NETS.RESET,
    });

    this.oeLines = {
      in: new Button(NETS.POWER, NETS.OE_IN),
      a: new Button(NETS.POWER, NETS.OE_A),
      b: new Button(NETS.POWER, NETS.OE_B),
      ir: new Button(NETS.POWER, NETS.OE_IR),
      alu: new Button(NETS.POWER, NETS.OE_ALU),
      ram: new Button(NETS.POWER, NETS.OE_RAM),
      pc: new Button(NETS.POWER, NETS.OE_PC),
    };
    this.loadLines = {
      a: new Button(NETS.POWER, NETS.LOAD_A),
      b: new Button(NETS.POWER, NETS.LOAD_B),
      ir: new Button(NETS.POWER, NETS.LOAD_IR),
      mar: new Button(NETS.POWER, NETS.LOAD_MAR),
      ram: new Button(NETS.POWER, NETS.LOAD_RAM),
      pc: new Button(NETS.POWER, NETS.LOAD_PC),
      out: new Button(NETS.POWER, NETS.LOAD_OUT),
    };
    this.subLine = new Button(NETS.POWER, NETS.SUB);
    this.pcEnableLine = new Button(NETS.POWER, NETS.PC_ENABLE);
    this.displaySignedLine = new Button(NETS.POWER, NETS.DISPLAY_SIGNED);
    this.cpuAutoLine = new Button(NETS.POWER, NETS.CPU_AUTO);
    this.resetLine = new Button(NETS.POWER, NETS.RESET);
    this.haltLine = new Button(NETS.POWER, NETS.HALT_BTN);
    this.flagsLine = new Button(NETS.POWER, NETS.LOAD_FLAGS);
    [
      ...Object.values(this.oeLines),
      ...Object.values(this.loadLines),
      this.subLine,
      this.pcEnableLine,
      this.displaySignedLine,
      this.cpuAutoLine,
      this.resetLine,
      this.haltLine,
      this.flagsLine,
    ].forEach((btn) => this.sim.addComponent(btn));

    this.inputButtons = IN_PINS.map((pin) => {
      const btn = new Button(NETS.POWER, pin);
      this.sim.addComponent(btn);
      return btn;
    });
    IN_PINS.forEach((pin, i) => {
      new TriStateBuffer(this.sim, pin, NETS.OE_IN, BUS_PINS[i]);
    });

    this.regA = new RegisterNBit(this.sim, {
      dataPins: BUS_PINS,
      load: NETS.LOAD_A,
      outputEnable: NETS.OE_A,
      clock: NETS.CLOCK,
      outputPins: BUS_PINS,
      power: NETS.POWER,
      ground: NETS.GROUND,
      clearLow: NETS.RESET_N,
      bitWidth: 8,
      prefix: "regA",
    });

    this.regB = new RegisterNBit(this.sim, {
      dataPins: BUS_PINS,
      load: NETS.LOAD_B,
      outputEnable: NETS.OE_B,
      clock: NETS.CLOCK,
      outputPins: BUS_PINS,
      power: NETS.POWER,
      ground: NETS.GROUND,
      clearLow: NETS.RESET_N,
      bitWidth: 8,
      prefix: "regB",
    });

    const irUnusedPins = [4, 5, 6, 7].map((i) => `ir_nc_${i}`);
    irUnusedPins.forEach((pin) => this.sim.addNet(pin));

    this.regIR = new RegisterNBit(this.sim, {
      dataPins: BUS_PINS,
      load: NETS.LOAD_IR,
      outputEnable: NETS.OE_IR,
      clock: NETS.CLOCK,
      outputPins: [...BUS_PINS.slice(0, 4), ...irUnusedPins],
      clearLow: NETS.RESET_N,
      power: NETS.POWER,
      ground: NETS.GROUND,
      bitWidth: 8,
      prefix: "regIR",
    });

    this.alu = new ALU(this.sim, {
      enableOut: NETS.OE_ALU,
      enableSub: NETS.SUB,
      inputA: this.regA.stateNets,
      inputB: this.regB.stateNets,
      output: BUS_PINS,
      power: NETS.POWER,
      ground: NETS.GROUND,
      prefix: "alu",
    });

    this.pc = new ProgramCounter(this.sim, {
      bus: BUS_PINS.slice(0, 4),
      clock: NETS.CLOCK,
      counterEnable: NETS.PC_ENABLE,
      counterOut: NETS.OE_PC,
      jump: NETS.LOAD_PC,
      clearLow: NETS.RESET_N,
      power: NETS.POWER,
      ground: NETS.GROUND,
      prefix: "pc",
    });

    this.display = new DisplayModule(this.sim, {
      data: BUS_PINS,
      load: NETS.LOAD_OUT,
      signed: NETS.DISPLAY_SIGNED,
      clock: NETS.CLOCK,
      clearLow: NETS.RESET_N,
      power: NETS.POWER,
      ground: NETS.GROUND,
      prefix: "display",
    });

    RAM_ADDR_PINS.forEach((pin) => {
      this.sim.addComponent(new PullDownResistor(pin));
    });

    this.ramAddressButtons = RAM_ADDR_PINS.map((pin) => {
      const btn = new Button(NETS.POWER, pin);
      this.sim.addComponent(btn);
      return btn;
    });

    this.mar = new AddressRegister(this.sim, {
      dataPins: BUS_PINS.slice(0, 4),
      load: NETS.LOAD_MAR,
      outputEnable: NETS.POWER,
      clock: NETS.CLOCK,
      outputPins: MAR_OUTPUT_PINS,
      power: NETS.POWER,
      ground: NETS.GROUND,
      prefix: "mar",
    });

    this.ram = new RAM16bytes(this.sim, {
      enableWrite: NETS.LOAD_RAM,
      enableRead: NETS.OE_RAM,
      address: MAR_OUTPUT_PINS,
      data: BUS_PINS,
      output: BUS_PINS,
      clock: NETS.CLOCK,
      power: NETS.POWER,
      ground: NETS.GROUND,
      contents: program,
      prefix: "ram",
    });

    new ORGate(
      this.sim,
      NETS.OE_ALU,
      NETS.LOAD_FLAGS,
      NETS.FLAGS_IN,
      NETS.POWER,
    );

    this.flags = new FlagsModule(this.sim, {
      sum: this.alu.sumNets,
      carry: this.alu.carryOutNet,
      load: NETS.FLAGS_IN,
      clock: NETS.CLOCK,
      clearLow: NETS.RESET_N,
      power: NETS.POWER,
      ground: NETS.GROUND,
      prefix: "flags",
    });

    const controlSignalsArray = [
      NETS.LOAD_A,
      NETS.OE_A,
      NETS.LOAD_B,
      NETS.LOAD_IR,
      NETS.OE_IR,
      NETS.OE_ALU,
      NETS.SUB,
      NETS.LOAD_RAM,
      NETS.OE_RAM,
      NETS.LOAD_MAR,
      NETS.OE_PC,
      NETS.PC_ENABLE,
      NETS.LOAD_PC,
      NETS.LOAD_OUT,
      NETS.HALT_ROM,
      NETS.FLAGS_IN,
    ];

    this.cpu = new CPUModule(this.sim, {
      controls: controlSignalsArray,
      romEnable: NETS.CPU_AUTO,
      instructionAddress: this.regIR.stateNets.slice(4, 8),
      clock: NETS.CLOCK,
      clearLow: NETS.RESET_N,
      power: NETS.POWER,
      ground: NETS.GROUND,
      flags: [this.flags.zeroNet, this.flags.carryNet],
      prefix: "cpu",
    });
  }

  step(dt) {
    this.sim.step(dt);
  }

  getSignal(net) {
    return this.sim.getSignal(net);
  }

  waitForClock(level) {
    return new Promise((resolve) => {
      let prev = this.getSignal(NETS.CLOCK);
      const id = setInterval(() => {
        const cur = this.getSignal(NETS.CLOCK);
        if (prev !== level && cur === level) {
          clearInterval(id);
          resolve();
        }
        prev = cur;
      }, 5);
    });
  }

  async clockPulse() {
    if (this.clock.mode === CLOCK_MODE.MANUAL) {
      return this.clock.pulse();
    }
    await this.waitForClock(SIGNAL.HIGH);
    await this.waitForClock(SIGNAL.LOW);
  }
}

export class SimulationUI {
  constructor(hardware) {
    this.hw = hardware;
    this.sim = hardware.sim;

    this.clockStatusEl = document.getElementById("clock-status");
    this.clockLedComp = new LED(NETS.CLOCK);
    this.sim.addComponent(this.clockLedComp);
    this.clockLedEl = document.getElementById("clock-led");

    document.querySelectorAll("[data-led-row]").forEach((row) => {
      const name = row.dataset.ledRow;
      const count = name === "cpu-decoder" ? 8 : name === "cpu-counter" ? 4 : 8;
      for (let bit = count - 1; bit >= 0; bit--) {
        const led = document.createElement("div");
        led.className = "led";
        led.dataset.reg = name;
        led.dataset.bit = String(bit);
        row.append(led);
      }
    });

    this.cpuControlLines = [
      ["AI", NETS.LOAD_A],
      ["AO", NETS.OE_A],
      ["BI", NETS.LOAD_B],
      ["BO", NETS.OE_B],
      ["II", NETS.LOAD_IR],
      ["IO", NETS.OE_IR],
      ["EO", NETS.OE_ALU],
      ["SU", NETS.SUB],
      ["RI", NETS.LOAD_RAM],
      ["RO", NETS.OE_RAM],
      ["MI", NETS.LOAD_MAR],
      ["CO", NETS.OE_PC],
      ["CE", NETS.PC_ENABLE],
      ["J", NETS.LOAD_PC],
      ["OI", NETS.LOAD_OUT],
      ["HLT", NETS.HALT_ROM],
      ["FI", NETS.FLAGS_IN],
      ["FC", this.hw.flags.carryNet],
      ["FZ", this.hw.flags.zeroNet],
      ["FN", this.hw.flags.negativeNet],
    ].map(([name, net]) => ({
      name,
      led: this.makeLeds([net])[0],
      element: document.querySelector(`[data-cpu-control="${name}"]`),
    }));

    this.busLedComps = this.makeLeds(BUS_PINS);
    this.busLedElements = document.querySelectorAll('.led[data-bus="true"]');
    this.busValueEl = document.getElementById("bus-value");

    const ledSources = [
      ["a", this.hw.regA.stateNets],
      ["b", this.hw.regB.stateNets],
      ["ir", this.hw.regIR.stateNets],
      ["pc", this.hw.pc.stateNets],
      ["alu-a", this.hw.regA.stateNets],
      ["alu-b", this.hw.regB.stateNets],
      ["alu-sum", this.hw.alu.sumNets],
      ["alu-carry", [this.hw.alu.carryOutNet]],
      ["cpu-counter", this.hw.cpu.counterOutputs],
      ["cpu-decoder", this.hw.cpu.stepDecoderOutputs],
      ["flags", this.hw.flags.stateNets],
    ];

    this.registerDisplays = ledSources
      .filter(([_, nets]) => {
        if (!Array.isArray(nets)) {
          return false;
        }
        return true;
      })
      .map(([_, nets]) => ({
        leds: this.makeLeds(nets),
        elements: document.querySelectorAll(`.led[data-reg="${_}"]`),
      }));

    this.ramAddressDisplayEl = document.getElementById("ram-display-address");
    this.ramDecimalDisplayEl = document.getElementById("ram-display-decimal");
    this.ramDataDisplayEl = document.getElementById("ram-display-data");
    this.ramRowElements = Array.from(document.querySelectorAll(".ram-row"));
    this.pcBinEl = document.getElementById("pc-bin");
    this.pcDecEl = document.getElementById("pc-dec");
    this.displayTubeEl = document.getElementById("display-tube");
    this.displayTextEl = document.getElementById("display-text");
    this.displayBinEl = document.getElementById("display-bin");
    this.displayDecEl = document.getElementById("display-dec");
    this.displayModeEl = document.getElementById("display-mode");
    this.tubeSegments = this.buildTube();

    const byId = (id) => document.getElementById(id);
    this.aluReadouts = [
      {
        nets: this.hw.regA.stateNets,
        bin: byId("alu-a-bin"),
        dec: byId("alu-a-dec"),
      },
      {
        nets: this.hw.regB.stateNets,
        bin: byId("alu-b-bin"),
        dec: byId("alu-b-dec"),
      },
      {
        nets: this.hw.alu.sumNets,
        bin: byId("alu-sum-bin"),
        dec: byId("alu-sum-dec"),
      },
    ];
    this.aluModeEl = byId("alu-mode");
    this.aluSumLabelEl = byId("alu-sum-label");
  }

  makeLeds(nets) {
    return nets.map((net) => {
      const led = new LED(net);
      this.sim.addComponent(led);
      return led;
    });
  }

  updateDisplay(ledComps, domElements) {
    domElements.forEach((el) => {
      const bitIndex = parseInt(el.getAttribute("data-bit"), 10);
      const ledComp = ledComps[bitIndex];
      if (ledComp) {
        el.classList.toggle("lit", ledComp.lit);
      }
    });
  }

  readNets(nets) {
    let bin = "";
    let value = 0;
    let valid = true;

    for (let i = nets.length - 1; i >= 0; i--) {
      const signal = this.sim.getSignal(nets[i]);

      if (signal === SIGNAL.HIGH) {
        bin += "1";
        value |= 1 << i;
      } else if (signal === SIGNAL.LOW) {
        bin += "0";
      } else {
        bin += "?";
        valid = false;
      }
    }

    return { bin, value: valid ? value : null };
  }

  formatRamBits(bits, { spaced = false } = {}) {
    const text = [...bits]
      .reverse()
      .map((bit) => (bit === null ? "?" : String(bit)));

    return spaced ? text.join(" ") : text.join("");
  }

  updateRamDisplay() {
    const address = this.readNets(MAR_OUTPUT_PINS);
    const memory = this.hw.ram.getMemorySnapshot();

    if (this.ramAddressDisplayEl) {
      this.ramAddressDisplayEl.textContent = address.bin;
    }

    if (this.ramDecimalDisplayEl) {
      this.ramDecimalDisplayEl.textContent =
        address.value === null ? "?" : String(address.value);
    }

    this.ramRowElements.forEach((rowEl) => {
      const rowAddress = Number(rowEl.dataset.address);
      const rowBits = memory[rowAddress];

      rowEl.classList.toggle(
        "selected",
        address.value !== null && rowAddress === address.value,
      );

      const bitsEl = rowEl.querySelector(".ram-bits");
      if (bitsEl && rowBits) {
        bitsEl.textContent = this.formatRamBits(rowBits, { spaced: true });
      }
    });

    if (this.ramDataDisplayEl) {
      this.ramDataDisplayEl.textContent =
        address.value === null
          ? "????????"
          : this.formatRamBits(memory[address.value]);
    }
  }

  toSigned(value, width = 8) {
    return value >= 1 << (width - 1) ? value - (1 << width) : value;
  }

  buildTube() {
    if (!this.displayTubeEl) return [];

    const SVG_NS = "http://www.w3.org/2000/svg";
    const shapes = [
      ["a", "h", 34, 6],
      ["b", "v", 58, 31],
      ["c", "v", 58, 79],
      ["d", "h", 34, 104],
      ["e", "v", 10, 79],
      ["f", "v", 10, 31],
      ["g", "h", 34, 55],
    ];

    const hexagon = (orientation, cx, cy) => {
      const half = (orientation === "h" ? 40 : 42) / 2;
      const t = 4;

      const points =
        orientation === "h"
          ? [
              [cx - half, cy],
              [cx - half + t, cy - t],
              [cx + half - t, cy - t],
              [cx + half, cy],
              [cx + half - t, cy + t],
              [cx - half + t, cy + t],
            ]
          : [
              [cx, cy - half],
              [cx + t, cy - half + t],
              [cx + t, cy + half - t],
              [cx, cy + half],
              [cx - t, cy + half - t],
              [cx - t, cy - half + t],
            ];

      return points.map((point) => point.join(",")).join(" ");
    };

    const digits = [];

    for (let digit = 0; digit < 4; digit++) {
      const svg = document.createElementNS(SVG_NS, "svg");
      svg.setAttribute("viewBox", "0 0 72 112");
      svg.setAttribute("class", "tube-digit");

      const segments = shapes.map(([name, orientation, cx, cy]) => {
        const polygon = document.createElementNS(SVG_NS, "polygon");
        polygon.setAttribute("points", hexagon(orientation, cx, cy));
        polygon.setAttribute("class", "segment");
        polygon.setAttribute("data-segment", name);
        svg.append(polygon);
        return polygon;
      });

      const dot = document.createElementNS(SVG_NS, "circle");
      dot.setAttribute("cx", "67");
      dot.setAttribute("cy", "104");
      dot.setAttribute("r", "4");
      dot.setAttribute("class", "segment");
      dot.setAttribute("data-segment", "dp");
      svg.append(dot);
      segments.push(dot);

      this.displayTubeEl.append(svg);
      digits.push(segments);
    }

    return digits;
  }

  updateDisplayModule() {
    const display = this.hw.display;
    const signed = this.sim.getSignal(NETS.DISPLAY_SIGNED) === SIGNAL.HIGH;
    display.getDigits().forEach((bits, digit) => {
      bits.forEach((bit, segment) => {
        this.tubeSegments[digit]?.[segment]?.classList.toggle("lit", bit === 1);
      });
    });

    if (this.displayTextEl) this.displayTextEl.textContent = display.getText();

    const { bin, value } = this.readNets(display.stateNets);

    if (this.displayBinEl) this.displayBinEl.textContent = bin;
    if (this.displayDecEl) {
      this.displayDecEl.textContent =
        value === null ? "?" : signed ? this.toSigned(value, 8) : value;
    }

    if (this.displayModeEl) {
      this.displayModeEl.textContent = signed ? "SIGNED" : "UNSIGNED";
      this.displayModeEl.classList.toggle("sub", signed);
    }
  }

  updatePcReadout() {
    const { bin, value } = this.readNets(this.hw.pc.stateNets);

    if (this.pcBinEl) this.pcBinEl.textContent = bin;
    if (this.pcDecEl) this.pcDecEl.textContent = value === null ? "?" : value;
  }

  updateAluReadouts() {
    const subtracting = this.sim.getSignal(NETS.SUB) === SIGNAL.HIGH;

    if (this.aluModeEl) {
      this.aluModeEl.textContent = subtracting ? "SUB" : "ADD";
      this.aluModeEl.classList.toggle("sub", subtracting);
    }
    if (this.aluSumLabelEl)
      this.aluSumLabelEl.textContent = subtracting ? "A \u2212 B" : "A + B";

    this.aluReadouts.forEach(({ nets, bin, dec }) => {
      const { bin: bits, value } = this.readNets(nets);
      if (bin) bin.textContent = bits;
      if (dec) {
        dec.textContent =
          value === null ? "?" : this.toSigned(value, nets.length);
      }
    });
  }

  updateCpuControlLines() {
    this.cpuControlLines.forEach(({ led, element }) => {
      if (!element) return;

      element
        .querySelector(".cpu-control-led")
        ?.classList.toggle("lit", led.lit);

      element.classList.toggle("active", led.lit);
    });
  }

  start() {
    const dt = 0.001;
    setInterval(() => {
      this.hw.step(dt);

      const clockSignal = this.sim.getSignal(NETS.CLOCK);
      if (this.clockStatusEl) this.clockStatusEl.textContent = clockSignal;
      if (this.clockLedEl)
        this.clockLedEl.classList.toggle("lit", this.clockLedComp.lit);

      this.updateDisplay(this.busLedComps, this.busLedElements);
      this.registerDisplays.forEach(({ leds, elements }) =>
        this.updateDisplay(leds, elements),
      );
      this.updateCpuControlLines();
      this.updateAluReadouts();
      this.updatePcReadout();
      this.updateDisplayModule();
      this.updateRamDisplay();

      const busStateStr = BUS_PINS.map((pin) =>
        this.sim.getSignal(pin) === SIGNAL.HIGH ? "1" : "0",
      )
        .reverse()
        .join("");

      if (this.busValueEl) this.busValueEl.textContent = busStateStr;
    }, 10);

    setupControls({
      oeLines: this.hw.oeLines,
      loadLines: this.hw.loadLines,
      inputButtons: this.hw.inputButtons,
      ramAddressButtons: this.hw.ramAddressButtons,
      subLine: this.hw.subLine,
      pcEnableLine: this.hw.pcEnableLine,
      displaySignedLine: this.hw.displaySignedLine,
      cpuAutoLine: this.hw.cpuAutoLine,
      resetLine: this.hw.resetLine,
      haltLine: this.hw.haltLine,
      clock: this.hw.clock,
      clockPulse: () => this.hw.clockPulse(),
      flagsLine: this.hw.flagsLine,
    });

    window.sim = this.sim;
    window.regs = { a: this.hw.regA, b: this.hw.regB, ir: this.hw.regIR };
    window.alu = this.hw.alu;
    window.pc = this.hw.pc;
    window.display = this.hw.display;
    window.ram = this.hw.ram;
    window.cpu = this.hw.cpu;
    window.flags = this.hw.flags;
  }
}

const hardware = new HardwareSimulation();
const ui = new SimulationUI(hardware);
ui.start();
