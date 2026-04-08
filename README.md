# repl-sandbox

Reusable Node.js VM sandbox with REPL state persistence, injectable builtins, session management, an FSM engine, and a bounded correction loop used by [matryoshka](https://github.com/yogthos/Matryoshka) and [chiasmus](https://github.com/yogthos/chiasmus).

Zero runtime dependencies — only uses Node.js `vm` and `crypto`.

## Install

```bash
npm install repl-sandbox
```

## Core Sandbox

Creates an isolated VM context where top-level variable declarations persist across executions (REPL semantics), console output is captured, and a memory buffer carries state between turns.

```ts
import { createSandbox } from "repl-sandbox";

const sandbox = createSandbox("document content here", {
  builtins: [GREP_IMPL, FUZZY_SEARCH_IMPL],
  globals: { myTool: (x) => x * 2 },
  initCode: `function double(x) { return myTool(x); }`,
  timeoutMs: 30000,
});

const result = await sandbox.execute("double(21)");
// { result: 42, logs: [], error: undefined }

// Variables persist across executions
await sandbox.execute("const x = 1");
await sandbox.execute("x + 1"); // result: 2

// Memory persists too
await sandbox.execute('memory.push("found")');
sandbox.getMemory(); // ["found"]

sandbox.dispose();
```

### Extension Model

Pass `globals` for host functions, `builtins` for injectable string modules, and `initCode` for bridge wrappers. This lets you extend the sandbox without duplicating the core.

## Builtins

Injectable function strings that run inside the VM. Each requires `context` (string) and/or `__linesArray` (string[]) in the VM context — both provided automatically by `createSandbox`.

```ts
import {
  GREP_IMPL,          // grep(pattern, flags) — regex search with line numbers
  FUZZY_SEARCH_IMPL,  // fuzzy_search(query, limit) — Bitap fuzzy matching
  COUNT_TOKENS_IMPL,  // count_tokens(text?) — token estimation
  LOCATE_LINE_IMPL,   // locate_line(start, end?) — extract lines by number
  LLM_QUERY_IMPL,     // llm_query(prompt), batch_llm_query(prompts) — requires __llmQueryBridge global
} from "repl-sandbox";
```

## Session Manager

Generic keyed cache with hash-based staleness detection and LRU eviction. Works with any disposable resource.

```ts
import { createSessionManager, hashContent } from "repl-sandbox";

const sessions = createSessionManager<Sandbox>({
  maxSessions: 100,
  dispose: (s) => s.dispose(),
});

const sandbox = await sessions.getOrCreate(
  "/path/to/file.txt",
  hashContent(fileContent),
  () => createSandbox(fileContent, { builtins: [...] }),
);
// Returns cached sandbox if key+hash match, creates new one otherwise
```

## FSM Engine

Generic declarative state machine. Each state has a handler and ordered transitions (first matching predicate wins).

```ts
import { FSMEngine, type FSMSpec } from "repl-sandbox";

const spec: FSMSpec<MyContext> = {
  initial: "start",
  terminal: new Set(["done"]),
  states: new Map([
    ["start", {
      handler: (ctx) => ({ ...ctx, count: ctx.count + 1 }),
      transitions: [
        ["done", (ctx) => ctx.count >= 3],
        ["start", () => true],
      ],
    }],
    ["done", { handler: (ctx) => ctx, transitions: [] }],
  ]),
};

const result = await new FSMEngine<MyContext>().run(spec, { count: 0 });
```

## Correction Loop

Bounded submit → check → fix → retry loop with full history tracking.

```ts
import { correctionLoop } from "repl-sandbox";

const result = await correctionLoop(
  initialSpec,
  (spec) => solver.solve(spec),                    // submit
  (r) => r.status === "error" ? r.error : null,    // isError
  (spec, error, round) => llmFix(spec, error),     // fixer
  { maxRounds: 5 },
);
// { result, converged: boolean, rounds: number, history: [...] }
```

## License

Apache-2.0
