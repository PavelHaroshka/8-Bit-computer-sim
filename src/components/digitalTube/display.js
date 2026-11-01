import { Timer555 } from "../../simulation/hardware";
import { ANDGate } from "../gates/andGate";
import { NOTGate } from "../gates/notGate";
import { MSJKFlipFlop } from "../latches/MSJKFlipFlop";
import { RegisterNBit } from "../registers";
import { buildDecimalDisplayContents, ROM } from "../rom";
import { FourDigitTube } from "./digitalTube4";

export class DisplayModule {
  constructor(
    sim,
    {
      data,
      load,
      signed,
      clock,
      clearLow,
      scanClock,
      scanHalfPeriod = 0.004,
      persistence = Infinity,
      power,
      ground,
      prefix = "display",
    },
  ) {
    if (!Array.isArray(data) || data.length !== 8) {
      throw new Error("DisplayModule requires 8 data (bus) pins.");
    }

    const suffix = sim.components.length;
    const net = (name) => {
      const id = `${prefix}-${name}-${suffix}`;
      sim.addNet(id);
      return id;
    };

    this.register = new RegisterNBit(sim, {
      dataPins: data,
      load,
      outputEnable: ground,
      clock,
      outputPins: data,
      clearLow,
      power,
      ground,
      bitWidth: 8,
      prefix: `${prefix}-out`,
    });
    this.stateNets = this.register.stateNets;

    let scan = scanClock;

    if (!scan) {
      scan = net("scan-clk");

      const resistanceB = 1000;
      const capacitance = scanHalfPeriod / (0.693 * resistanceB);

      sim.addTimedComponent(
        new Timer555({
          output: scan,
          resistanceA: 1,
          resistanceB,
          capacitance,
        }),
      );
    }

    const q0 = net("digit-q0");
    const q1 = net("digit-q1");
    const nq0 = net("digit-nq0");
    const nq1 = net("digit-nq1");
    const q0Bar = net("digit-q0-bar");
    const q1Bar = net("digit-q1-bar");

    new NOTGate(sim, q0, nq0, ground);
    new NOTGate(sim, q1, nq1, ground);

    new MSJKFlipFlop(sim, {
      j: power,
      k: power,
      clock: scan,
      q: q0,
      qBar: q0Bar,
      power,
      ground,
      prefix: `${prefix}-scan0-${suffix}`,
    });

    new MSJKFlipFlop(sim, {
      j: q0,
      k: q0,
      clock: scan,
      q: q1,
      qBar: q1Bar,
      power,
      ground,
      prefix: `${prefix}-scan1-${suffix}`,
    });

    this.selectNets = [0, 1, 2, 3].map((k) => {
      const select = net(`select-${k}`);
      new ANDGate(sim, k & 1 ? q0 : nq0, k & 2 ? q1 : nq1, select, power);
      return select;
    });

    this.segmentNets = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => net(`segment-${i}`));

    this.rom = new ROM(sim, {
      address: [...this.stateNets, q0, q1, signed],
      output: this.segmentNets,
      contents: buildDecimalDisplayContents(),
    });

    const [s0, s1, s2, s3] = this.selectNets;

    this.tube = new FourDigitTube(sim, {
      segments: this.segmentNets.slice(0, 7),
      dp: this.segmentNets[7],
      digits: [s3, s2, s1, s0],
      persistence,
    });
  }

  getText() {
    return this.tube.getText();
  }

  getDigits() {
    return this.tube.getDigits();
  }
}
