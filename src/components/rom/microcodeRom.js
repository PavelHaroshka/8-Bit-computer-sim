const bit = (n) => 1 << n;
export const CONTROL = {
  AI: bit(15),
  AO: bit(14),
  BI: bit(13),
  II: bit(12),
  IO: bit(11),
  EO: bit(10),
  SU: bit(9),
  RI: bit(8),
  RO: bit(7),
  MI: bit(6),
  CO: bit(5),
  CE: bit(4),
  J: bit(3),
  OI: bit(2),
  HLT: bit(1),
  FI: bit(0),
};
export function microcode(...signals) {
  return signals.reduce((word, signal) => word | CONTROL[signal], 0);
}

const romAddr = (instruction, step) => (instruction << 3) | step;

export const flags = {
  NO_FLAGS: 0b00,
  ALL_FLAGS: 0b11,
  ZF: 0b01,
  CF: 0b10,
};

export const instructons = {
  NOOP: 0b0000,
  LDA: 0b0001,
  ADD: 0b0010,
  SUB: 0b0011,
  STA: 0b0100,
  LIA: 0b0101,
  JMP: 0b0110,
  JMPC: 0b0111,
  JMPZ: 0b1000,
  OUT: 0b1110,
  HLT: 0b1111,
};

const composeAsm = () => {
  const fetchLoop = (address) => [
    { address: romAddr(address, 0), code: microcode("CO", "MI") },
    { address: romAddr(address, 1), code: microcode("II", "RO", "CE") },
  ];

  const noop = (address, step) => ({
    address: romAddr(address, step),
    code: microcode(),
  });

  const composed = {
    NOOP: (address) => [
      ...fetchLoop(address),
      noop(address, 2),
      noop(address, 3),
      noop(address, 4),
    ],
    LDA: (address) => [
      ...fetchLoop(address),
      { address: romAddr(address, 2), code: microcode("IO", "MI") },
      { address: romAddr(address, 3), code: microcode("RO", "AI") },
      noop(address, 4),
    ],
    ADD: (address) => [
      ...fetchLoop(address),
      { address: romAddr(address, 2), code: microcode("IO", "MI") },
      { address: romAddr(address, 3), code: microcode("RO", "BI") },
      { address: romAddr(address, 4), code: microcode("EO", "AI", "FI") },
    ],
    SUB: (address) => [
      ...fetchLoop(address),
      { address: romAddr(address, 2), code: microcode("IO", "MI") },
      { address: romAddr(address, 3), code: microcode("RO", "BI") },
      {
        address: romAddr(address, 4),
        code: microcode("EO", "AI", "SU", "FI"),
      },
    ],
    STA: (address) => [
      ...fetchLoop(address),
      { address: romAddr(address, 2), code: microcode("IO", "MI") },
      { address: romAddr(address, 3), code: microcode("AO", "RI") },
      noop(address, 4),
    ],
    LIA: (address) => [
      ...fetchLoop(address),
      { address: romAddr(address, 2), code: microcode("IO", "AI") },
      noop(address, 3),
      noop(address, 4),
    ],
    JMP: (address) => [
      ...fetchLoop(address),
      { address: romAddr(address, 2), code: microcode("IO", "J") },
      noop(address, 3),
      noop(address, 4),
    ],
    OUT: (address) => [
      ...fetchLoop(address),
      { address: romAddr(address, 2), code: microcode("AO", "OI") },
      noop(address, 3),
      noop(address, 4),
    ],
    HLT: (address) => [
      ...fetchLoop(address),
      { address: romAddr(address, 2), code: microcode("HLT") },
      noop(address, 3),
      noop(address, 4),
    ],
    JMPC: (address) => [
      ...fetchLoop(address),
      noop(address, 2),
      noop(address, 3),
      noop(address, 4),
    ],
    JMPZ: (address) => [
      ...fetchLoop(address),
      noop(address, 2),
      noop(address, 3),
      noop(address, 4),
    ],
  };

  return composed;
};

export function buildMicrocodeContents() {
  const commands = [];
  const contents = new Array(512).fill(0);

  Object.values(flags).forEach((flag) => {
    Object.entries(instructons).forEach(
      ([instruction, instructionAdressValue]) => {
        const address = (flag << 4) | instructionAdressValue;
        const asm = composeAsm();
        let memRow = asm[instruction](address);

        if (
          (flag === flags.ALL_FLAGS || flag === flags.CF) &&
          instruction === "JMPC"
        ) {
          const override = asm.JMPC(address);
          override[2].code = microcode("IO", "J");
          memRow = override;
        }

        if (
          (flag === flags.ALL_FLAGS || flag === flags.ZF) &&
          instruction === "JMPZ"
        ) {
          const override = asm.JMPZ(address);
          override[2].code = microcode("IO", "J");
          memRow = override;
        }

        commands.push(memRow);
      },
    );
  });

  commands.forEach((row) => {
    Object.values(row).forEach(({ address, code }) => {
      contents[address] = code;
    });
  });

  return contents;
}
