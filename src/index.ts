// Core sandbox
export { createSandbox } from "./sandbox.js";
export type { Sandbox, SandboxResult, SandboxOptions } from "./types.js";

// Code transforms (useful for custom sandbox variants)
export { extractDeclarations, wrapCodeForReturn } from "./code-transform.js";

// Safe globals builder
export { buildSafeGlobals } from "./safe-globals.js";

// Builtins
export {
  GREP_IMPL,
  FUZZY_SEARCH_IMPL,
  COUNT_TOKENS_IMPL,
  LOCATE_LINE_IMPL,
  LLM_QUERY_IMPL,
} from "./builtins/index.js";

// Session manager
export { createSessionManager, hashContent } from "./session.js";
export type { SessionManager, SessionManagerOptions } from "./session.js";

// FSM engine
export { FSMEngine } from "./fsm.js";
export type { FSMSpec, State, Predicate, RunOptions } from "./fsm.js";

// Correction loop
export { correctionLoop } from "./correction-loop.js";
export type {
  Fixer,
  Submitter,
  ErrorCheck,
  CorrectionAttempt,
  CorrectionResult,
  CorrectionLoopOptions,
} from "./correction-loop.js";
