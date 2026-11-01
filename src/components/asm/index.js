import { instructons } from "../rom/microcodeRom";

const ASM = () => {
  let pc = 0;
  const program = new Array(16).fill(0);

  const emit = (opcode, arg = 0) => {
    program[pc++] = (opcode << 4) | (arg & 0xf);
  };

  const self = {
    NOOP: () => (emit(instructons.NOOP), self),
    LDA: (arg) => (emit(instructons.LDA, arg), self),
    LIA: (arg) => (emit(instructons.LIA, arg), self),
    ADD: (arg) => (emit(instructons.ADD, arg), self),
    SUB: (arg) => (emit(instructons.SUB, arg), self),
    STA: (arg) => (emit(instructons.STA, arg), self),
    JMP: (arg) => (emit(instructons.JMP, arg), self),
    JMPC: (arg) => (emit(instructons.JMPC, arg), self),
    JMPZ: (arg) => (emit(instructons.JMPZ, arg), self),
    OUT: () => (emit(instructons.OUT), self),
    HLT: () => (emit(instructons.HLT), self),
    set: (address, value) => ((program[address] = value), self),
    compile: () => program,
  };

  return self;
};

// const asm = ASM()
//   .LIA(1)
//   .OUT()
//   .SUB(15)
//   .JMPZ(5)
//   .JMP(1)
//   .HLT()
//   .set(15, 1)
//   .compile();

// const asm = ASM()
//   .LIA(15)
//   .OUT()
//   .ADD(14)
//   .JMPC(5)
//   .JMP(1)
//   .OUT()
//   .HLT()
//   .set(14, 100)
//   .compile();

const asm = ASM()
  .LDA(14)
  .SUB(12)
  .JMPC(6)
  .LDA(13)
  .OUT()
  .HLT()
  .STA(14)
  .LDA(13)
  .ADD(15)
  .STA(13)
  .JMP(0)
  .set(12, 1)
  .set(14, 3)
  .set(15, 2)
  .compile();

export const program = asm;
