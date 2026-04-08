/** Result of a single sandbox code execution. */
export interface SandboxResult {
  result: unknown;
  logs: string[];
  error?: string;
}

/** A sandbox instance with execute/memory/dispose lifecycle. */
export interface Sandbox {
  execute(code: string, timeoutMs?: number): Promise<SandboxResult>;
  getMemory(): unknown[];
  dispose(): void;
}

/** Options for createSandbox(). */
export interface SandboxOptions {
  /** Additional globals injected into the VM context. */
  globals?: Record<string, unknown>;
  /** Builtin function strings to inject (e.g. GREP_IMPL, FUZZY_SEARCH_IMPL). */
  builtins?: string[];
  /** Additional init code run after builtins (for registering bridge wrappers). */
  initCode?: string;
  /** Default execution timeout in ms (default: 30000). */
  timeoutMs?: number;
  /** Max persistent log entries before truncation (default: 5000). */
  maxLogs?: number;
}
