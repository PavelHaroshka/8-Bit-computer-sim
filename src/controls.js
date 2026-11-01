const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const RESET_SETTLE_MS = 150;

export class SimulationControls {
  constructor({
    oeLines,
    loadLines,
    inputButtons,
    ramAddressButtons = [],
    subLine,
    pcEnableLine,
    displaySignedLine,
    resetLine,
    haltLine,
    cpuAutoLine,
    clock,
    clockPulse,
    flagsLine,
  }) {
    this.oeLines = oeLines;
    this.loadLines = loadLines;
    this.inputButtons = inputButtons;
    this.ramAddressButtons = ramAddressButtons;
    this.subLine = subLine;
    this.pcEnableLine = pcEnableLine;
    this.displaySignedLine = displaySignedLine;
    this.resetLine = resetLine;
    this.haltLine = haltLine;
    this.cpuAutoLine = cpuAutoLine;
    this.clockPulse = clockPulse;
    this.clock = clock;
    this.flagsLine = flagsLine;

    const $ = (id) => document.getElementById(id);
    this.panel = $("controls-panel");
    this.toggle = $("controls-toggle");
    this.header = $("controls-header");
    this.closeBtn = $("controls-close");
    this.cpuModeButton = $("cpu-mode-toggle");
    this.clockStepButton = $("clock-step");

    if (!this.panel || !this.toggle) {
      return;
    }

    this.oeChips = [...this.panel.querySelectorAll("[data-oe]")];
    this.loadChips = [...this.panel.querySelectorAll("[data-load]")];
    this.modeChips = [...this.panel.querySelectorAll("[data-alu-mode]")];
    this.countChips = [...this.panel.querySelectorAll("[data-pc-count]")];
    this.displayChips = [...this.panel.querySelectorAll("[data-display-mode]")];
    this.manualSections = [
      ...this.panel.querySelectorAll("[data-manual-only]"),
    ];
    this.resetChip = this.panel.querySelector("[data-reset]");
    this.haltChip = this.panel.querySelector("[data-halt]");
    this.flagsChips = [...this.panel.querySelectorAll("[data-flags-load]")];

    this.oe = "none";
    this.loads = new Set();
    this.bits = Array(8).fill(false);
    this.addressBits = Array(4).fill(false);
    this.subtract = false;
    this.countEnabled = false;
    this.displaySigned = false;
    this.halted = false;
    this.cpuAuto = true;
    this.busy = false;
    this.drag = null;
    this.flagsLatch = false;

    this.switchRow = $("input-switches");
    this.switchEls = [];
    this.addressRow = $("ram-address-switches");
    this.addressEls = [];

    this.initUI();
    this.initEvents();
  }

  renderInput() {
    let value = 0;

    this.bits.forEach((on, i) => {
      this.inputButtons[i]?.setPressed(!this.cpuAuto && on);
      this.switchEls[i]?.classList.toggle("on", on);

      if (this.switchEls[i]) {
        this.switchEls[i].textContent = on ? "1" : "0";
      }

      if (on) value |= 1 << i;
    });

    const binary = document.getElementById("input-binary");
    const decimal = document.getElementById("input-decimal");

    if (binary) {
      binary.textContent = [...this.bits]
        .reverse()
        .map((b) => (b ? "1" : "0"))
        .join("");
    }

    if (decimal) {
      decimal.textContent = value > 127 ? value - 256 : value;
    }
  }

  renderAddress() {
    let address = 0;

    this.addressBits.forEach((on, i) => {
      this.ramAddressButtons[i]?.setPressed(!this.cpuAuto && on);
      this.addressEls[i]?.classList.toggle("on", on);

      if (this.addressEls[i]) {
        this.addressEls[i].textContent = on ? "1" : "0";
      }

      if (on) address |= 1 << i;
    });

    const binary = document.getElementById("ram-address-binary");
    const decimal = document.getElementById("ram-address-decimal");

    if (binary) {
      binary.textContent = [...this.addressBits]
        .reverse()
        .map((b) => (b ? "1" : "0"))
        .join("");
    }

    if (decimal) {
      decimal.textContent = String(address);
    }
  }

  setAuto(auto) {
    if (this.busy) return;
    this.cpuAuto = auto;

    if (auto) {
      this.oe = "none";
      this.loads.clear();
      this.subtract = false;
      this.countEnabled = false;
      this.displaySigned = false;
      this.flagsLatch = false;
    }

    this.clock?.setMode(auto ? "auto" : "manual");
    this.applyLines();
  }

  initUI() {
    if (this.switchRow) {
      for (let i = 7; i >= 0; i--) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "switch";
        b.title = `Bit ${i}`;
        b.textContent = "0";

        b.addEventListener("click", () => {
          if (this.cpuAuto) return;
          this.bits[i] = !this.bits[i];
          this.renderInput();
        });

        this.switchRow.append(b);
        this.switchEls[i] = b;
      }
    }

    if (this.addressRow) {
      for (let i = 3; i >= 0; i--) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "switch";
        b.title = `Address bit ${i}`;
        b.textContent = "0";

        b.addEventListener("click", () => {
          if (this.cpuAuto) return;
          this.addressBits[i] = !this.addressBits[i];
          this.renderAddress();
        });

        this.addressRow.append(b);
        this.addressEls[i] = b;
      }
    }

    this.clock?.setMode(this.cpuAuto ? "auto" : "manual");
    this.applyLines();
  }

  applyLines() {
    const auto = this.cpuAuto;

    Object.values(this.oeLines).forEach((btn) => {
      btn.setEnabled(!auto);
    });

    Object.values(this.loadLines).forEach((btn) => {
      btn.setEnabled(!auto);
    });

    this.subLine?.setEnabled(!auto);
    this.pcEnableLine?.setEnabled(!auto);
    this.displaySignedLine?.setEnabled(!auto);
    this.flagsLine?.setEnabled(!auto);

    Object.entries(this.oeLines).forEach(([key, btn]) => {
      btn.setPressed(!auto && key === this.oe);
    });

    Object.entries(this.loadLines).forEach(([key, btn]) => {
      btn.setPressed(!auto && this.loads.has(key));
    });

    this.subLine?.setPressed(!auto && this.subtract);
    this.pcEnableLine?.setPressed(!auto && this.countEnabled);
    this.displaySignedLine?.setPressed(!auto && this.displaySigned);
    this.flagsLine?.setPressed(!auto && this.flagsLatch);

    this.haltLine?.setPressed(this.halted);
    this.cpuAutoLine?.setPressed(auto);

    this.renderInput();
    this.renderAddress();

    if (this.cpuModeButton) {
      this.cpuModeButton.textContent = auto ? "Auto Mode" : "Manual Mode";
      this.cpuModeButton.classList.toggle("active", !auto);
      this.cpuModeButton.setAttribute("aria-pressed", String(auto));
    }
    if (this.clockStepButton) {
      this.clockStepButton.disabled = auto || this.halted;
    }

    this.manualSections.forEach((s) => {
      s.classList.toggle("locked", auto);
      s.querySelectorAll("button").forEach((b) => (b.disabled = auto));
    });

    this.oeChips.forEach((chip) => {
      chip.classList.toggle("active", chip.dataset.oe === this.oe);
    });

    this.loadChips.forEach((chip) => {
      const key = chip.dataset.load;
      chip.classList.toggle("active", this.loads.has(key));
      chip.disabled = auto || key === this.oe;
    });

    this.modeChips.forEach((chip) => {
      chip.classList.toggle(
        "active",
        chip.dataset.aluMode === (this.subtract ? "sub" : "add"),
      );
    });

    this.countChips.forEach((chip) => {
      chip.classList.toggle("active", this.countEnabled);
      chip.setAttribute("aria-pressed", String(this.countEnabled));
    });

    this.displayChips.forEach((chip) => {
      chip.classList.toggle(
        "active",
        chip.dataset.displayMode ===
          (this.displaySigned ? "signed" : "unsigned"),
      );
    });

    if (this.haltChip) {
      this.haltChip.classList.toggle("active", this.halted);
      this.haltChip.setAttribute("aria-pressed", String(this.halted));
    }

    this.flagsChips.forEach((chip) => {
      chip.classList.toggle("active", this.flagsLatch);
      chip.setAttribute("aria-pressed", String(this.flagsLatch));
    });
  }

  releaseAll() {
    this.oe = "none";
    this.loads.clear();
    this.countEnabled = false;
    this.flagsLatch = false;
    this.applyLines();
  }

  closePanel() {
    if (this.busy) return;
    this.releaseAll();
    this.panel.hidden = true;
  }

  initEvents() {
    this.oeChips.forEach((chip) => {
      chip.addEventListener("click", async () => {
        if (this.busy || this.cpuAuto) return;

        this.oe = chip.dataset.oe;

        this.loads.delete(this.oe);
        this.applyLines();

        this.busy = true;
        try {
          await sleep(20);
        } finally {
          this.busy = false;
        }
      });
    });

    this.loadChips.forEach((chip) => {
      chip.addEventListener("click", () => {
        if (this.busy || this.cpuAuto) return;

        const key = chip.dataset.load;

        if (this.loads.has(key)) {
          this.loads.delete(key);
        } else {
          this.loads.add(key);
        }

        this.applyLines();
      });
    });

    this.modeChips.forEach((chip) => {
      chip.addEventListener("click", () => {
        if (this.busy || this.cpuAuto) return;

        this.subtract = chip.dataset.aluMode === "sub";
        this.applyLines();
      });
    });

    this.countChips.forEach((chip) => {
      chip.addEventListener("click", () => {
        if (this.busy || this.cpuAuto) return;

        this.countEnabled = !this.countEnabled;
        this.applyLines();
      });
    });

    this.displayChips.forEach((chip) => {
      chip.addEventListener("click", () => {
        if (this.busy || this.cpuAuto) return;

        this.displaySigned = chip.dataset.displayMode === "signed";
        this.applyLines();
      });
    });

    this.haltChip?.addEventListener("click", () => {
      this.halted = !this.halted;
      this.applyLines();
    });

    this.flagsChips.forEach((chip) => {
      chip.addEventListener("click", () => {
        if (this.busy || this.cpuAuto) return;

        this.flagsLatch = !this.flagsLatch;
        this.applyLines();
      });
    });

    this.resetChip?.addEventListener("click", async () => {
      if (this.busy) return;
      this.busy = true;

      this.halted = false;
      this.applyLines();
      this.resetLine?.setPressed(true);
      this.resetChip.classList.add("active");
      try {
        await sleep(RESET_SETTLE_MS);
        await Promise.race([this.clockPulse(), sleep(3000)]);
        await sleep(RESET_SETTLE_MS);
      } finally {
        this.resetLine?.setPressed(false);
        this.resetChip.classList.remove("active");
        this.busy = false;
      }
    });

    this.cpuModeButton?.addEventListener("click", () => {
      this.setAuto(!this.cpuAuto);
    });

    this.clockStepButton?.addEventListener("click", async () => {
      if (this.cpuAuto || this.clockStepButton.disabled) return;
      this.clockStepButton.disabled = true;
      try {
        await this.clockPulse();
      } finally {
        this.clockStepButton.disabled = this.cpuAuto || this.halted;
      }
    });

    this.toggle.addEventListener("click", () => {
      if (this.panel.hidden) {
        this.panel.hidden = false;
      } else {
        this.closePanel();
      }
    });

    this.closeBtn?.addEventListener("click", () => {
      this.closePanel();
    });

    this.header?.addEventListener("pointerdown", (e) => {
      if (e.target.closest("button")) return;

      const rect = this.panel.getBoundingClientRect();
      this.drag = {
        dx: e.clientX - rect.left,
        dy: e.clientY - rect.top,
      };

      this.header.setPointerCapture(e.pointerId);
    });

    this.header?.addEventListener("pointermove", (e) => {
      if (!this.drag) return;

      this.panel.style.left = `${e.clientX - this.drag.dx}px`;
      this.panel.style.top = `${e.clientY - this.drag.dy}px`;
      this.panel.style.right = "auto";
      this.panel.style.bottom = "auto";
    });

    this.header?.addEventListener("pointerup", () => {
      this.drag = null;
    });

    this.header?.addEventListener("pointercancel", () => {
      this.drag = null;
    });
  }
}

export function setupControls(params) {
  return new SimulationControls(params);
}
