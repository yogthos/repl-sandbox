import { describe, it, expect } from "vitest";
import { FSMEngine, type FSMSpec } from "../src/fsm.js";

interface Counter {
  value: number;
  done: boolean;
}

describe("FSMEngine", () => {
  it("runs a simple state machine to completion", async () => {
    const spec: FSMSpec<Counter> = {
      initial: "increment",
      terminal: new Set(["done"]),
      states: new Map([
        [
          "increment",
          {
            handler: (ctx) => ({ ...ctx, value: ctx.value + 1 }),
            transitions: [
              ["done", (ctx) => ctx.value >= 3],
              ["increment", () => true],
            ],
          },
        ],
        [
          "done",
          {
            handler: (ctx) => ({ ...ctx, done: true }),
            transitions: [],
          },
        ],
      ]),
    };

    const engine = new FSMEngine<Counter>();
    const result = await engine.run(spec, { value: 0, done: false });
    expect(result.value).toBe(3);
    expect(result.done).toBe(true);
  });

  it("calls onTransition callback", async () => {
    const transitions: Array<[string, string]> = [];
    const spec: FSMSpec<Counter> = {
      initial: "a",
      terminal: new Set(["b"]),
      states: new Map([
        [
          "a",
          {
            handler: (ctx) => ctx,
            transitions: [["b", () => true]],
          },
        ],
        [
          "b",
          {
            handler: (ctx) => ({ ...ctx, done: true }),
            transitions: [],
          },
        ],
      ]),
    };

    const engine = new FSMEngine<Counter>();
    await engine.run(spec, { value: 0, done: false }, {
      onTransition: (from, to) => transitions.push([from, to]),
    });
    expect(transitions).toEqual([["a", "b"]]);
  });

  it("throws on unknown state", async () => {
    const spec: FSMSpec<Counter> = {
      initial: "nonexistent",
      terminal: new Set(["done"]),
      states: new Map(),
    };

    const engine = new FSMEngine<Counter>();
    await expect(
      engine.run(spec, { value: 0, done: false }),
    ).rejects.toThrow('unknown state "nonexistent"');
  });

  it("throws on no matching transition", async () => {
    const spec: FSMSpec<Counter> = {
      initial: "stuck",
      terminal: new Set(["done"]),
      states: new Map([
        [
          "stuck",
          {
            handler: (ctx) => ctx,
            transitions: [["done", () => false]],
          },
        ],
      ]),
    };

    const engine = new FSMEngine<Counter>();
    await expect(
      engine.run(spec, { value: 0, done: false }),
    ).rejects.toThrow('no matching transition from state "stuck"');
  });

  it("throws on max iterations exceeded", async () => {
    const spec: FSMSpec<Counter> = {
      initial: "loop",
      terminal: new Set(["done"]),
      maxIterations: 5,
      states: new Map([
        [
          "loop",
          {
            handler: (ctx) => ctx,
            transitions: [["loop", () => true]],
          },
        ],
      ]),
    };

    const engine = new FSMEngine<Counter>();
    await expect(
      engine.run(spec, { value: 0, done: false }),
    ).rejects.toThrow("max iterations (5) exceeded");
  });

  it("supports async handlers", async () => {
    const spec: FSMSpec<Counter> = {
      initial: "async_step",
      terminal: new Set(["done"]),
      states: new Map([
        [
          "async_step",
          {
            handler: async (ctx) => {
              await new Promise((r) => setTimeout(r, 1));
              return { ...ctx, value: 99 };
            },
            transitions: [["done", () => true]],
          },
        ],
        [
          "done",
          {
            handler: (ctx) => ({ ...ctx, done: true }),
            transitions: [],
          },
        ],
      ]),
    };

    const engine = new FSMEngine<Counter>();
    const result = await engine.run(spec, { value: 0, done: false });
    expect(result.value).toBe(99);
  });
});
