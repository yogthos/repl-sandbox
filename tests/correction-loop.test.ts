import { describe, it, expect } from "vitest";
import { correctionLoop } from "../src/correction-loop.js";

interface MockResult {
  status: "ok" | "error";
  error?: string;
}

describe("correctionLoop", () => {
  it("converges on first try if no error", async () => {
    const result = await correctionLoop<string, MockResult>(
      "input1",
      async () => ({ status: "ok" }),
      (r) => (r.status === "error" ? r.error! : null),
      async () => null,
    );

    expect(result.converged).toBe(true);
    expect(result.rounds).toBe(1);
    expect(result.history).toHaveLength(1);
  });

  it("fixes errors and converges", async () => {
    const result = await correctionLoop<string, MockResult>(
      "bad-input",
      async (input) => {
        if (input === "fixed-input") return { status: "ok" };
        return { status: "error", error: "syntax error" };
      },
      (r) => (r.status === "error" ? r.error! : null),
      async () => "fixed-input",
    );

    expect(result.converged).toBe(true);
    expect(result.rounds).toBe(2);
    expect(result.history).toHaveLength(2);
    expect(result.history[0].result.status).toBe("error");
    expect(result.history[1].result.status).toBe("ok");
  });

  it("stops when fixer gives up (returns null)", async () => {
    const result = await correctionLoop<string, MockResult>(
      "bad",
      async () => ({ status: "error", error: "unfixable" }),
      (r) => (r.status === "error" ? r.error! : null),
      async () => null,
    );

    expect(result.converged).toBe(false);
    expect(result.rounds).toBe(1);
  });

  it("stops at max rounds", async () => {
    const result = await correctionLoop<string, MockResult>(
      "bad",
      async () => ({ status: "error", error: "still broken" }),
      (r) => (r.status === "error" ? r.error! : null),
      async (input) => input + "!",
      { maxRounds: 3 },
    );

    expect(result.converged).toBe(false);
    expect(result.rounds).toBe(3);
    expect(result.history).toHaveLength(3);
  });

  it("passes round number and result to fixer", async () => {
    const fixerCalls: Array<{ round: number; error: string }> = [];

    await correctionLoop<string, MockResult>(
      "input",
      async () => ({ status: "error", error: "err" }),
      (r) => (r.status === "error" ? r.error! : null),
      async (_input, error, round) => {
        fixerCalls.push({ round, error });
        if (round >= 2) return null;
        return "patched";
      },
      { maxRounds: 5 },
    );

    expect(fixerCalls).toEqual([
      { round: 1, error: "err" },
      { round: 2, error: "err" },
    ]);
  });

  it("tracks full history", async () => {
    const result = await correctionLoop<number, MockResult>(
      0,
      async (input) => {
        if (input >= 3) return { status: "ok" };
        return { status: "error", error: `need ${3 - input} more` };
      },
      (r) => (r.status === "error" ? r.error! : null),
      async (input) => input + 1,
    );

    expect(result.converged).toBe(true);
    expect(result.rounds).toBe(4);
    expect(result.history.map((h) => h.input)).toEqual([0, 1, 2, 3]);
  });
});
