import { LED } from "../../simulation/hardware";
import { SIGNAL } from "../../simulation/signals";

export class DigitalTube {
  constructor(sim, data, dp) {
    if (!Array.isArray(data) || (data.length !== 7 && data.length !== 8)) {
      throw new Error(
        "DigitalTube requires 7 segment nets (a-g), plus an optional dp.",
      );
    }

    this.sim = sim;
    this.segmentNets = data.slice(0, 7);
    this.dp = dp ?? data[7] ?? null;
    this.nets = this.dp ? [...this.segmentNets, this.dp] : this.segmentNets;

    this.leds = this.nets.map((net) => {
      const led = new LED(net);
      sim.addComponent(led);
      return led;
    });
  }

  getMemorySnapshot() {
    return this.nets.map((net) => {
      const signal = this.sim.getSignal(net);

      if (signal === SIGNAL.HIGH) return 1;
      if (signal === SIGNAL.LOW) return 0;

      return null;
    });
  }

  getSegments() {
    return this.getMemorySnapshot();
  }

  get lit() {
    return this.leds.map((led) => led.lit);
  }
}

export const SEVEN_SEGMENT_HEX = [
  0x3f, // 0
  0x06, // 1
  0x5b, // 2
  0x4f, // 3
  0x66, // 4
  0x6d, // 5
  0x7d, // 6
  0x07, // 7
  0x7f, // 8
  0x6f, // 9
  0x77, // A
  0x7c, // b
  0x39, // C
  0x5e, // d
  0x79, // E
  0x71, // F
];

export const SEGMENT_BLANK = 0x00;
export const SEGMENT_MINUS = 0x40;

const HEX_CHARS = "0123456789AbCdEF";

export function decodeSegments(bits) {
  const segments = bits.slice(0, 7);

  if (segments.some((bit) => bit === null)) return "?";

  const code = segments.reduce((sum, bit, i) => sum | (bit << i), 0);

  let char;
  if (code === SEGMENT_BLANK) char = " ";
  else if (code === SEGMENT_MINUS) char = "-";
  else {
    const index = SEVEN_SEGMENT_HEX.indexOf(code);
    char = index === -1 ? "?" : HEX_CHARS[index];
  }

  return bits[7] === 1 ? `${char}.` : char;
}
