import { SIGNAL } from "../../simulation/signals";
import { ANDGate, NOTGate } from "../gates";
import { Register } from "../registers";

export class RAM16bytes {
  constructor(
    sim,
    {
      enableWrite,
      enableRead,
      address,
      data,
      output,
      clock,
      power,
      ground,
      contents = [],
      prefix = "ram16",
    },
  ) {
    this.sim = sim;
    const ADDRESS_BITS = 4;
    const ROWS = 16;
    const COLUMNS = 8;

    for (const [name, pins, length] of [
      ["address", address, ADDRESS_BITS],
      ["data", data, COLUMNS],
      ["output", output, COLUMNS],
    ]) {
      if (!Array.isArray(pins) || pins.length !== length) {
        throw new Error(`RAM16bytes requires ${length} ${name} pins.`);
      }
    }

    if (!Array.isArray(contents) || contents.length > 16) {
      throw new Error("RAM16bytes contents must contain at most 16 bytes.");
    }

    for (const byte of contents) {
      if (!Number.isInteger(byte) || byte < 0 || byte > 0xff) {
        throw new Error(`Invalid RAM byte: ${byte}`);
      }
    }

    const suffix = sim.components.length;

    const addressTrue = [];
    const addressInverted = [];

    for (let bit = 0; bit < ADDRESS_BITS; bit++) {
      const inverted = `${prefix}-address-inverted-${bit}-${suffix}`;
      sim.addNet(inverted);
      new NOTGate(sim, address[bit], inverted, ground);
      addressTrue.push(address[bit]);
      addressInverted.push(inverted);
    }

    this.rowSelectNets = [];
    this.readLines = [];
    this.writeLines = [];

    for (let row = 0; row < ROWS; row++) {
      const [a0, a1, a2, a3] = addressTrue.map((_, bit) =>
        (row >> bit) & 1 ? addressTrue[bit] : addressInverted[bit],
      );

      const nets = {
        and1: `${prefix}-row-${row}-and1-${suffix}`,
        and2: `${prefix}-row-${row}-and2-${suffix}`,
        select: `${prefix}-row-${row}-select-${suffix}`,
        read: `${prefix}-row-${row}-read-${suffix}`,
        write: `${prefix}-row-${row}-write-${suffix}`,
      };
      Object.values(nets).forEach((net) => sim.addNet(net));

      new ANDGate(sim, a0, a1, nets.and1, power);
      new ANDGate(sim, a2, a3, nets.and2, power);
      new ANDGate(sim, nets.and1, nets.and2, nets.select, power);

      new ANDGate(sim, nets.select, enableRead, nets.read, power);
      new ANDGate(sim, nets.select, enableWrite, nets.write, power);

      this.rowSelectNets.push(nets.select);
      this.readLines.push(nets.read);
      this.writeLines.push(nets.write);
    }

    this.cells = [];
    this.registerCells = [];

    for (let row = 0; row < ROWS; row++) {
      const cellRow = [];
      const regRow = [];

      for (let col = 0; col < COLUMNS; col++) {
        const byte = contents[row] ?? 0;
        const initialState = (byte >> col) & 1 ? SIGNAL.HIGH : SIGNAL.LOW;

        const cell = new Register(sim, {
          data: data[col],
          load: this.writeLines[row],
          outputEnable: this.readLines[row],
          clock,
          output: output[col],
          power,
          ground,
          initialState,
          prefix: `${prefix}-cell-r${row}-c${col}-${suffix}`,
        });

        cellRow.push(cell.flopOut);
        regRow.push(cell);
      }

      this.cells.push(cellRow);
      this.registerCells.push(regRow);
    }

    this.loadProgram(contents);
  }

  loadProgram(contents = [], startAddress = 0) {
    if (!Array.isArray(contents)) {
      throw new TypeError("Program contents must be an array.");
    }

    if (
      !Number.isInteger(startAddress) ||
      startAddress < 0 ||
      startAddress > 15
    ) {
      throw new RangeError("Start address must be between 0 and 15.");
    }

    if (startAddress + contents.length > 16) {
      throw new RangeError("Program exceeds the 16-byte RAM.");
    }

    const normalized = contents.map((value) => {
      if (!Number.isInteger(value) || value < 0 || value > 255) {
        throw new RangeError(`Invalid byte: ${value}`);
      }

      return value;
    });

    normalized.forEach((value, offset) => {
      const row = this.registerCells[startAddress + offset];

      row.forEach((cell, bit) => {
        cell.setState?.((value >> bit) & 1);
      });
    });
  }

  getMemorySnapshot() {
    return this.cells.map((row) =>
      row.map((flopOutNet) => {
        const signal = this.sim.getSignal(flopOutNet);

        if (signal === SIGNAL.HIGH) return 1;
        if (signal === SIGNAL.LOW) return 0;

        return null;
      }),
    );
  }
}
