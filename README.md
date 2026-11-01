# 8-bit CPU Simulator

A browser-based 8-bit computer in the style of Ben Eater's SAP-1, simulated down to the gate level. It has an 8-bit bus, a 4-bit program counter, 16 bytes of RAM, an ALU with add and subtract, a flags register, a seven-segment display and a microcoded control unit.

Every part has an LED view in the UI. A manual panel lets you drive each control line by hand, and an auto mode hands control to the microcode ROM and a clock.

## Simulation engine

The engine lives in `src/simulation/`.

- **Nets and drivers.** The `Simulation` holds named nets. Components drive them with strong drivers, and weak pull-ups and pull-downs provide defaults. Nets joined by closed switches or conducting transistors are merged with union-find. A net with both HIGH and LOW drivers resolves to `UNKNOWN` and logs a contention warning.
- **`settle()`.** Each iteration freezes a snapshot, evaluates every component against it and resolves all nets. It repeats until nothing changes, so every gate has exactly one iteration of delay. Simulated time does not advance while settling.
- **`stabilize()`.** It settles, then looks for clock edges on clocked components (`sample()` then `commit()`), and repeats until stable.
- **`step(dt)`.** It advances simulated time and applies scheduled events. Timed components (the 555 timers and the RC clock capacitor) live here. The UI calls it every 10 ms with `dt = 0.001`.
- **Hardware primitives.** Power, ground, switches, buttons, LEDs, NPN transistors, pull resistors, a capacitor, a threshold detector and a 555 timer.

## CPU components

| Part                       | Notes                                                                                                                                                                                               |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Registers A, B, IR         | Built from `Register` cells (load mux, flip-flop, tri-state output) via `RegisterNBit`. All are cleared by `RESET_N`. IR exposes its high nibble to the control unit and its low nibble to the bus. |
| ALU                        | 8-bit adder built from two 4-bit adders. XOR on B plus carry-in = `SUB` gives subtraction. It drives the bus through tri-state buffers.                                                             |
| Program counter            | Synchronous 4-bit counter with load (jump), enable and bus output.                                                                                                                                  |
| MAR and RAM                | A 4-bit address register feeds a 16x8 RAM made of register cells, with row decode from AND gates. The program is preset through a per-bit `initialState`.                                           |
| Flags register             | 4 bits: Carry, Zero, Negative, and one reserved. Zero is an OR tree over the sum bits followed by a NOT. Loaded by the `FI` control line.                                                           |
| Display                    | Output register, a 555-driven scan clock, a 2-bit scan counter and a ROM holding decimal and signed 7-segment patterns, driving a four-digit tube.                                                  |
| Control unit (`CPUModule`) | Step counter on the inverted clock, a 3-to-8 decoder and a 512-entry microcode ROM.                                                                                                                 |
| Clock                      | Manual pulse mode and an auto mode driven by an RC oscillator model. Halt stops the clock, and reset overrides halt.                                                                                |

### Control unit

The microcode ROM address is `{C, Z, opcode[3:0], step[2:0]}`, with step in the low bits. The step counter resets at decoder output 4, so each instruction has up to 5 steps (T0 to T4).

In `CPUModule` the flag nets must be passed in this order, because the microcode puts `ZF` on address bit 7 and `CF` on bit 8:

```javascript
flags: [this.flags.zeroNet, this.flags.carryNet];
```

## Instruction set

Instructions are one byte: `opcode << 4 | operand`.

| Mnemonic | Opcode | Effect                     |
| -------- | ------ | -------------------------- |
| `NOOP`   | `0000` | Nothing                    |
| `LDA n`  | `0001` | A = RAM[n]                 |
| `ADD n`  | `0010` | A = A + RAM[n], sets flags |
| `SUB n`  | `0011` | A = A - RAM[n], sets flags |
| `STA n`  | `0100` | RAM[n] = A                 |
| `LIA n`  | `0101` | A = n (4-bit immediate)    |
| `JMP n`  | `0110` | PC = n                     |
| `JMPC n` | `0111` | PC = n if carry is set     |
| `JMPZ n` | `1000` | PC = n if zero is set      |
| `OUT`    | `1110` | Display A                  |
| `HLT`    | `1111` | Halt the clock             |

After `SUB`, carry means **no borrow** (it is the carry-out of `A + ~B + 1`). So `JMPC` after a `SUB` jumps when `A >= B`, and `JMPZ` jumps when `A == B`.

Flags are only updated by `ADD` and `SUB` (through `FI`). `LIA 0` followed by `JMPZ` does not see Z = 1.

### Microcode

The control word is 16 bits, MSB first:

```
AI AO BI II IO EO SU RI RO MI CO CE J OI HLT FI
```

Every instruction starts with the same fetch:

```
T0: CO|MI
T1: RO|II|CE
```

The instruction then runs its own steps from T2 (for example `ADD` is `IO|MI`, `RO|BI`, `EO|AI|FI`). The conditional jumps are `IO|J` at T2 only in the flag-matching ROM rows.

## Writing programs

`src/components/asm.js` is a small chainable assembler that builds the 16-byte RAM image:

```javascript
const asm = ASM()
  .LIA(3) // 0
  .OUT() // 1
  .SUB(15) // 2
  .JMPZ(5) // 3: halt when the result reaches zero
  .JMP(1) // 4
  .HLT() // 5
  .set(15, 1) // data
  .compile();

export const program = asm;
```

Code and data share the same 16 bytes, so keep data addresses clear of the instructions.

## UI and controls

`main.js` wires the machine and a `SimulationUI` that shows:

- LEDs for the bus, A, B, IR, PC, ALU inputs, sum and carry, flags, step counter, decoder and every control line
- the RAM rows with the selected address highlighted
- binary and decimal readouts and the four-digit display tube

`controls.js` provides the manual panel: output-enable and load chips, input switches, RAM address switches, ALU mode, PC count, flags latch, display mode, reset, halt and single step. The CPU Mode toggle switches between manual and auto. In auto mode, the manual buttons are disabled and released so they cannot fight the ROM on shared nets.

## Design notes and lessons

- **Sample settled values at clock edges.** `settle()` is a lockstep model, so level-sensitive state inside feedback loops is fragile.
  - A gate-level NOR SR latch with identical gate delays oscillates `(1,1) <-> (0,0)` after a short set pulse.
  - A transparent master latch stores glitches while control lines settle, and that skips instructions.
  - The current `MSJKFlipFlop` and `SRLatch` are behavioral and sample once, at the settled falling edge.
- **Gate-level latches** (the old NOR-based `SRLatch` and master/slave wiring) are kept only as teaching components.
- **Presets.** `initialState` flows `RAM16bytes -> Register -> MSJKFlipFlop`. The master and slave must start equal, or the first settle wipes the preset.
- **Flip-flop timing.** Outputs update on the falling clock edge, and the step counter runs on the inverted clock.

## Fixed along the way

1. The second fetch failed to stabilize (NOR latch oscillation).
2. Instructions were skipped after the JK swap (glitch capture in the transparent master).
3. RAM presets were lost (`SRLatch` overwrote `initialState` with LOW).
4. `ADD` never wrote back, because the step counter reset at step 3. It now resets at `decoderOut[4]`.
5. Added the flags register, `FI`, `JMPC` and `JMPZ`, and the matching UI.
6. Microcode bugs: 15-digit `CONTROL` literals (now `bit(n)`), the string-versus-number comparison that stopped the jump overrides from firing, and the flag bit order.

Verified: `JMPZ` halts when a counter reaches zero, and `JMPC` halts at 59 after an `ADD` overflow (15, 115, 215, then 59).
