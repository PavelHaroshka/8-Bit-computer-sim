import { Net } from "./net";
import { SIGNAL } from "./signals";

const MAX_SETTLE_ITERATIONS = 100;
const MAX_EDGE_ROUNDS = 50;
const TRACE_DEPTH = 6;

export class Simulation {
  constructor() {
    this.nets = new Map();
    this.components = [];
    this.timedComponents = [];
    this.sequentialComponents = [];
    this.nextDriverId = 0;
    this.time = 0;
    this.drivers = new Map();
    this.owned = new Map();
    this.events = [];
    this.nextEventId = 0;
    this.pendingOutputs = new Map();
    this.pendingConnections = new Map();
    this.effectiveConnections = new Map();
    this.stable = null;
    this.warnOnContention = true;
  }

  addNet(id, options = {}) {
    if (this.nets.has(id)) throw new Error(`Net already exists: ${id}`);
    const net = new Net(id, options);
    this.nets.set(id, net);
    return net;
  }

  getNet(netId) {
    const net = this.nets.get(netId);
    if (!net) throw new Error(`Net "${netId}" does not exist`);
    return net;
  }

  addComponent(component) {
    if (!component || !component.terminals) {
      throw new Error(
        `Invalid component passed to addComponent(): ${component?.constructor?.name ?? component}`,
      );
    }

    for (const [terminal, netId] of Object.entries(component.terminals)) {
      if (!this.nets.has(netId)) {
        throw new Error(`Unknown net "${netId}" on terminal "${terminal}"`);
      }
    }

    if (component.clockNetId !== undefined) {
      if (!this.nets.has(component.clockNetId)) {
        throw new Error(`Unknown clock net "${component.clockNetId}"`);
      }
      if (
        typeof component.sample !== "function" ||
        typeof component.commit !== "function"
      ) {
        throw new Error(
          "Clocked component must implement sample() and commit()",
        );
      }
      this.sequentialComponents.push(component);
    }

    component.driverId = `driver-${this.nextDriverId++}`;

    if (typeof component.attachSimulation === "function") {
      component.attachSimulation(this);
    }

    this.components.push(component);
  }

  addTimedComponent(component) {
    if (!component || typeof component.advanceTime !== "function") {
      throw new Error("Timed component must implement advanceTime(dt)");
    }

    if (component.terminals && !this.components.includes(component)) {
      this.addComponent(component);
    }

    if (!this.timedComponents.includes(component)) {
      this.timedComponents.push(component);
    }

    return component;
  }

  getSignal(netId) {
    return this.getNet(netId).signal;
  }

  getVoltage(netId) {
    return this.getNet(netId).voltage;
  }

  setInitialSignal(netId, signal) {
    const net = this.getNet(netId);

    if (
      signal !== SIGNAL.HIGH &&
      signal !== SIGNAL.LOW &&
      signal !== SIGNAL.FLOATING &&
      signal !== SIGNAL.UNKNOWN
    ) {
      throw new Error(`Invalid initial signal: ${signal}`);
    }

    net.signal = signal;
  }

  setInitialVoltage(netId, voltage) {
    this.getNet(netId).setVoltage(voltage);
  }

  snapshot() {
    return Object.fromEntries(
      [...this.nets].map(([id, net]) => [id, net.signal]),
    );
  }

  scheduleEvent(event) {
    event.id = this.nextEventId++;
    this.events.push(event);
    this.events.sort((a, b) => a.time - b.time || a.id - b.id);
    return event;
  }

  cancelEvent(event) {
    if (!event) return;
    this.events = this.events.filter((e) => e !== event);
  }

  applyEvent(event) {
    if (event.type === "connection") {
      if (this.pendingConnections.get(event.key) !== event) return false;
      this.pendingConnections.delete(event.key);
      this.setConnection(event);
      return true;
    }

    if (this.pendingOutputs.get(event.key) !== event) return false;
    this.pendingOutputs.delete(event.key);
    this.setDriver(event.key, event.netId, event.signal);
    return true;
  }

  setDriver(key, netId, signal) {
    if (signal === SIGNAL.FLOATING) {
      this.drivers.delete(key);
    } else {
      this.drivers.set(key, { netId, signal });
    }
  }

  driveOutput(key, netId, signal, delay = 0) {
    if (!Number.isFinite(delay) || delay < 0) {
      throw new Error(`Invalid output delay: ${delay}`);
    }

    const current = this.drivers.get(key);
    const effective = current ? current.signal : SIGNAL.FLOATING;
    const pending = this.pendingOutputs.get(key);

    if (effective === signal) {
      if (pending) {
        this.pendingOutputs.delete(key);
        this.cancelEvent(pending);
      }
      return;
    }

    if (pending && pending.signal === signal) return;

    if (pending) {
      this.pendingOutputs.delete(key);
      this.cancelEvent(pending);
    }

    if (delay === 0) {
      this.setDriver(key, netId, signal);
      return;
    }

    const event = this.scheduleEvent({
      type: "output",
      key,
      netId,
      signal,
      time: this.time + delay,
    });
    this.pendingOutputs.set(key, event);
  }

  setConnection({ key, switchId, aNetId, bNetId, closed }) {
    if (closed) {
      this.effectiveConnections.set(key, { switchId, aNetId, bNetId });
    } else {
      this.effectiveConnections.delete(key);
    }
  }

  scheduleConnection(switchId, aNetId, bNetId, closed, delay = 0) {
    if (!Number.isFinite(delay) || delay < 0) {
      throw new Error("Connection delay must be a finite non-negative number");
    }

    const key = switchId;
    const pending = this.pendingConnections.get(key);

    if (
      pending &&
      pending.closed === closed &&
      pending.aNetId === aNetId &&
      pending.bNetId === bNetId
    ) {
      return;
    }

    if (pending) {
      this.pendingConnections.delete(key);
      this.cancelEvent(pending);
    }

    const current = this.effectiveConnections.get(key);
    const alreadyEffective = closed
      ? current && current.aNetId === aNetId && current.bNetId === bNetId
      : !current;

    if (alreadyEffective) return;

    if (delay === 0) {
      this.setConnection({ key, switchId, aNetId, bNetId, closed });
      return;
    }

    const event = this.scheduleEvent({
      type: "connection",
      key,
      switchId,
      aNetId,
      bNetId,
      closed,
      time: this.time + delay,
    });
    this.pendingConnections.set(key, event);
  }

  settle() {
    const trace = [];

    for (let i = 0; i < MAX_SETTLE_ITERATIONS; i++) {
      const snapshot = this.snapshot();
      const nextPulls = new Map(
        [...this.nets.keys()].map((id) => [id, new Map()]),
      );

      for (const component of this.components) {
        this.collectOutputs(component, snapshot);

        for (const pull of component.pulls?.(snapshot, this) ?? []) {
          const pulls = nextPulls.get(pull.netId);
          if (!pulls) throw new Error(`Unknown pull net: ${pull.netId}`);
          pulls.set(pull.pullId, {
            signal: pull.signal,
            strength: pull.strength ?? 1,
          });
        }

        const connection = component.connectionState?.();
        if (connection) {
          if (
            !this.nets.has(connection.aNetId) ||
            !this.nets.has(connection.bNetId)
          ) {
            throw new Error("Switch references an unknown net");
          }
          this.scheduleConnection(
            connection.switchId,
            connection.aNetId,
            connection.bNetId,
            connection.closed,
            component.switchingDelay ?? 0,
          );
        }
      }

      const { changed, conflicts, changedNets } = this.resolve(nextPulls);

      trace.push({ iteration: i, changedNets, conflicts });
      if (trace.length > TRACE_DEPTH) trace.shift();

      if (!changed) {
        return;
      }
    }

    throw new Error("Circuit did not stabilize");
  }

  setSignal(netId, signal) {
    this.setInitialSignal(netId, signal);
  }

  collectOutputs(component, snapshot) {
    const evaluated = component.eval(snapshot, this);
    const outputs =
      evaluated == null
        ? []
        : Array.isArray(evaluated)
          ? evaluated
          : [evaluated];

    const previous = this.owned.get(component) ?? new Map();
    const now = new Map();

    for (const output of outputs) {
      if (!this.nets.has(output.netId)) {
        throw new Error(`Unknown output net: ${output.netId}`);
      }
      if (!output.driverId) {
        throw new Error("Component output is missing driverId");
      }

      const key = `${output.driverId}@${output.netId}`;
      now.set(key, output.netId);

      this.driveOutput(
        key,
        output.netId,
        output.signal,
        output.delay ?? component.outputDelay ?? 0,
      );
    }

    for (const [key, netId] of previous) {
      if (!now.has(key)) {
        this.driveOutput(
          key,
          netId,
          SIGNAL.FLOATING,
          component.outputDelay ?? 0,
        );
      }
    }

    this.owned.set(component, now);
  }

  resolve(nextPulls) {
    for (const [id, net] of this.nets) {
      net.pulls = nextPulls.get(id);
      net.drivers.clear();
    }

    for (const [key, d] of this.drivers) {
      this.getNet(d.netId).drivers.set(key, d.signal);
    }

    const parent = new Map([...this.nets.keys()].map((id) => [id, id]));

    const find = (id) => {
      let root = id;
      while (parent.get(root) !== root) root = parent.get(root);
      while (parent.get(id) !== root) {
        const next = parent.get(id);
        parent.set(id, root);
        id = next;
      }
      return root;
    };

    for (const c of this.effectiveConnections.values()) {
      const a = find(c.aNetId);
      const b = find(c.bNetId);
      if (a !== b) parent.set(b, a);
    }

    const groups = new Map();
    for (const [id, net] of this.nets) {
      const root = find(id);
      if (!groups.has(root))
        groups.set(root, { nets: [], drivers: [], pulls: [] });
      const group = groups.get(root);
      group.nets.push(net);
      group.drivers.push(...net.drivers.values());
      group.pulls.push(...net.pulls.values());
    }

    let changed = false;
    const conflicts = [];
    const changedNets = [];

    for (const group of groups.values()) {
      const signals =
        group.drivers.length > 0
          ? group.drivers
          : this.strongestPullSignals(group.pulls);

      if (signals.includes(SIGNAL.HIGH) && signals.includes(SIGNAL.LOW)) {
        conflicts.push({
          nets: group.nets.map((n) => n.id),
          drivers: group.drivers,
          pulls: group.pulls,
        });
      }

      const signal =
        signals.length === 0
          ? this.resolveUndriven(group.nets)
          : group.nets[0].resolveSignals(signals);

      for (const net of group.nets) {
        if (net.signal !== signal) {
          changed = true;
          changedNets.push(`${net.id}: ${net.signal} -> ${signal}`);
        }
        net.signal = signal;
      }
    }

    return { changed, conflicts, changedNets };
  }

  strongestPullSignals(pulls) {
    let max = -Infinity;
    for (const p of pulls) if (p.strength > max) max = p.strength;
    return pulls.filter((p) => p.strength === max).map((p) => p.signal);
  }

  resolveUndriven(nets) {
    const held = new Set();

    for (const net of nets) {
      if (
        net.retainCharge &&
        (net.signal === SIGNAL.HIGH || net.signal === SIGNAL.LOW)
      ) {
        held.add(net.signal);
      }
    }

    if (held.size === 0) return SIGNAL.FLOATING;
    if (held.size === 1) return [...held][0];
    return SIGNAL.UNKNOWN;
  }

  hasEdge(component, before, after) {
    const prev = before[component.clockNetId];
    const now = after[component.clockNetId];
    const edge = component.clockEdge ?? "rising";

    const rising = prev === SIGNAL.LOW && now === SIGNAL.HIGH;
    const falling = prev === SIGNAL.HIGH && now === SIGNAL.LOW;

    return edge === "both"
      ? rising || falling
      : edge === "falling"
        ? falling
        : rising;
  }

  stabilize() {
    for (let round = 0; round < MAX_EDGE_ROUNDS; round++) {
      this.settle();

      const after = this.snapshot();
      const before = this.stable ?? after;
      const edged = this.sequentialComponents.filter((c) =>
        this.hasEdge(c, before, after),
      );

      this.stable = after;

      if (edged.length === 0) {
        for (const component of this.components) component.observe?.(after);
        return;
      }

      const samples = edged.map((c) => [c, c.sample(before, this)]);
      for (const [c, next] of samples) c.commit(next, this);
    }

    throw new Error("Clock edges did not stabilize");
  }

  advanceTimed(elapsed) {
    if (elapsed <= 0) return;

    for (const component of this.timedComponents) {
      component.advanceTime(elapsed);
    }

    this.time += elapsed;

    for (const component of this.timedComponents) {
      component.publishVoltage?.(this);
    }
  }

  step(dt) {
    if (!Number.isFinite(dt) || dt <= 0) {
      throw new Error("Time step must be a finite positive number");
    }

    const targetTime = this.time + dt;

    while (this.events.length > 0 && this.events[0].time <= targetTime) {
      const eventTime = Math.max(this.time, this.events[0].time);
      this.advanceTimed(eventTime - this.time);

      while (this.events.length > 0 && this.events[0].time <= eventTime) {
        this.applyEvent(this.events.shift());
      }

      this.stabilize();
    }

    this.advanceTimed(targetTime - this.time);
    this.time = targetTime;
    this.stabilize();
  }

  tick() {
    this.stabilize();
  }
}
