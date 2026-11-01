# 8-Bit CPU Simulator

A browser-based, gate-level simulation of an 8-bit computer inspired by [Ben Eater's SAP-1](https://eater.net/8bit).

Built to explore how a CPU works from the ground up — from individual logic gates and transistors to registers, arithmetic, memory, and instruction execution.

The simulator features a shared 8-bit bus, 16 bytes of RAM, an ALU, a microcoded control unit, and a four-digit seven-segment display. Every component has a visual representation, with LEDs exposing internal signals as the computer runs.

You can run programs automatically or take manual control of the hardware, toggling control signals and watching how the machine responds.

## Features

- **Gate-level simulation** — logic gates, transistors, electrical nets, pull resistors, and clocked components.
- **Interactive hardware** — visual representations of registers, the ALU, RAM, the program counter, and control signals.
- **Manual and automatic modes** — experiment with individual control lines or let the microcode execute instructions.
- **8-bit ALU** — addition and subtraction, with Carry and Zero flags.
- **Microcoded control unit** — a ROM generates the control signals that drive each instruction.
- **16 bytes of RAM** — enough to run small programs and experiment with memory addressing.
- **Seven-segment display** — a multiplexed four-digit output display.
- **JavaScript assembler** — write small programs using readable instruction names.

## The computer

The design follows the spirit of Ben Eater's SAP-1, with a few additions and a focus on simulating the underlying hardware rather than simply reproducing CPU behavior.

| Component       | Description                                                                      |
| --------------- | -------------------------------------------------------------------------------- |
| Registers       | A, B, and instruction registers built from smaller register cells.               |
| ALU             | An 8-bit adder built from two 4-bit adders, supporting addition and subtraction. |
| Program counter | A 4-bit counter that tracks the next instruction and supports jumps.             |
| Memory          | A 4-bit address register and 16 × 8 RAM.                                         |
| Flags           | Carry and Zero flags used by conditional jumps.                                  |
| Control unit    | A microcode ROM, instruction decoder, and step counter.                          |
| Display         | A four-digit seven-segment display with multiplexed scanning.                    |
| Clock           | Manual pulses or an automatic RC oscillator model.                               |

## Instruction set

Instructions are one byte: four bits for the opcode and four bits for the operand.

| Instruction | Operation                            |
| ----------- | ------------------------------------ |
| `NOOP`      | Do nothing.                          |
| `LDA n`     | Load `RAM[n]` into A.                |
| `ADD n`     | Add `RAM[n]` to A.                   |
| `SUB n`     | Subtract `RAM[n]` from A.            |
| `STA n`     | Store A in `RAM[n]`.                 |
| `LIA n`     | Load a 4-bit immediate value into A. |
| `JMP n`     | Jump to address `n`.                 |
| `JMPC n`    | Jump if Carry is set.                |
| `JMPZ n`    | Jump if Zero is set.                 |
| `OUT`       | Send A to the display.               |
| `HLT`       | Halt the clock.                      |

The Carry flag after subtraction indicates **no borrow**, so `JMPC` can be used to compare unsigned values. Flags are updated by `ADD` and `SUB`, not by loading values into registers.

## Writing programs

Programs are assembled in JavaScript and loaded into RAM. Instructions and data share the same 16-byte memory space.

For example, this program counts down from three and halts at zero:

```javascript
const asm = ASM()
  .LIA(3)
  .OUT()
  .SUB(15)
  .JMPZ(5)
  .JMP(1)
  .HLT()
  .set(15, 1)
  .compile();

export const program = asm;
```

## Under the hood

The simulator uses a custom digital logic engine to model electrical connections and component behavior.

- Nets resolve their state from strong drivers and weak pull-ups or pull-downs.
- Conflicting strong HIGH and LOW drivers produce an `UNKNOWN` state and a contention warning.
- Combinational logic settles iteratively, with each gate introducing one iteration of propagation delay.
- Clocked components sample and commit state changes at clock edges.
- Timed components, including the 555 timers and RC clock, advance with simulated time.

This separation between signal propagation, clocked state changes, and simulated time makes it possible to explore not just what the CPU does, but how its hardware gets there.

## Running locally

```bash
git clone https://github.com/PavelHaroshka/8-Bit-computer-sim.git
cd 8-Bit-computer-sim
npm install
npm run dev
```

Open the local URL provided by Vite and start experimenting.
