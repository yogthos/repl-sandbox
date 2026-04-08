/**
 * Core VM sandbox factory.
 *
 * Creates an isolated Node.js vm context with REPL-like state persistence,
 * console capture, memory buffer, and an extension model for injecting
 * additional globals, builtins, and init code.
 *
 * NOTE: Node's vm module provides contextual isolation but NOT security
 * isolation. For production use with untrusted code, consider running in
 * a Docker container or using isolated-vm.
 */

import vm from "node:vm";
import { buildSafeGlobals } from "./safe-globals.js";
import { extractDeclarations, wrapCodeForReturn } from "./code-transform.js";
import type { Sandbox, SandboxOptions, SandboxResult } from "./types.js";

/**
 * Create a sandboxed execution environment with REPL-like state persistence.
 *
 * @param context - The document/text content available as `context` inside the VM.
 * @param options - Configuration: extra globals, builtins, init code, timeouts.
 * @returns A Sandbox with execute/getMemory/dispose.
 *
 * @example
 * ```ts
 * import { createSandbox } from "repl-sandbox";
 * import { GREP_IMPL, FUZZY_SEARCH_IMPL } from "repl-sandbox/builtins";
 *
 * const sandbox = createSandbox("file contents here", {
 *   builtins: [GREP_IMPL, FUZZY_SEARCH_IMPL],
 *   globals: { __llmQueryBridge: myLlmFn },
 *   initCode: `async function llm_query(p) { return await __llmQueryBridge(p); }`,
 * });
 *
 * const result = await sandbox.execute('grep("ERROR")');
 * ```
 */
export function createSandbox(
  context: string,
  options: SandboxOptions = {},
): Sandbox {
  const {
    globals: extraGlobals = {},
    builtins = [],
    initCode = "",
    timeoutMs: defaultTimeout = 30000,
    maxLogs = 5000,
  } = options;

  const logs: string[] = [];
  const memory: unknown[] = [];
  let disposed = false;

  // Pre-compute text stats and lines array for builtins
  const lines = context.split("\n");
  const textStats = {
    length: context.length,
    lineCount: lines.length,
    sample: {
      start: lines.slice(0, 5).join("\n"),
      middle: lines
        .slice(
          Math.max(0, Math.floor(lines.length / 2) - 2),
          Math.floor(lines.length / 2) + 3,
        )
        .join("\n"),
      end: lines.slice(-5).join("\n"),
    },
  };

  // Console with log capture
  const consoleImpl = {
    log: (...args: unknown[]) => {
      const MAX_LOG_ENTRY = 10_000;
      const MAX_ARG_LENGTH = 1_000;
      logs.push(
        args
          .map((a) => String(a).slice(0, MAX_ARG_LENGTH))
          .join(" ")
          .slice(0, MAX_LOG_ENTRY),
      );
    },
    error: (...args: unknown[]) => {
      const MAX_LOG_ENTRY = 10_000;
      const MAX_ARG_LENGTH = 1_000;
      logs.push(
        `[ERROR] ${args.map((a) => String(a).slice(0, MAX_ARG_LENGTH)).join(" ")}`.slice(
          0,
          MAX_LOG_ENTRY,
        ),
      );
    },
    warn: (...args: unknown[]) => {
      const MAX_LOG_ENTRY = 10_000;
      const MAX_ARG_LENGTH = 1_000;
      logs.push(
        `[WARN] ${args.map((a) => String(a).slice(0, MAX_ARG_LENGTH)).join(" ")}`.slice(
          0,
          MAX_LOG_ENTRY,
        ),
      );
    },
  };

  // Build sandbox globals: safe builtins + context + memory + console + extras
  const sandboxGlobals: Record<string, unknown> = {
    ...buildSafeGlobals(),
    context,
    memory,
    console: consoleImpl,
    text_stats: () => ({ ...textStats }),
    __linesArray: lines,
    ...extraGlobals,
  };

  // Create VM context
  const vmContext = vm.createContext(sandboxGlobals);

  // Initialize builtins + custom init code
  const allInitCode = [...builtins, initCode].filter(Boolean).join("\n\n");
  if (allInitCode) {
    vm.runInContext(allInitCode, vmContext);
  }

  return {
    async execute(
      code: string,
      timeoutMs = defaultTimeout,
    ): Promise<SandboxResult> {
      if (disposed) {
        return {
          result: null,
          logs: [],
          error: "Sandbox has been disposed",
        };
      }

      const executionLogs: string[] = [];

      // Temporarily redirect console to capture per-execution logs
      const originalLog = consoleImpl.log;
      const originalError = consoleImpl.error;
      const originalWarn = consoleImpl.warn;

      const MAX_LOG_ENTRY = 10_000;
      consoleImpl.log = (...args: unknown[]) => {
        const msg = args
          .map((a) => String(a))
          .join(" ")
          .slice(0, MAX_LOG_ENTRY);
        executionLogs.push(msg);
        logs.push(msg);
      };
      consoleImpl.error = (...args: unknown[]) => {
        const msg =
          `[ERROR] ${args.map((a) => String(a)).join(" ")}`.slice(
            0,
            MAX_LOG_ENTRY,
          );
        executionLogs.push(msg);
        logs.push(msg);
      };
      consoleImpl.warn = (...args: unknown[]) => {
        const msg =
          `[WARN] ${args.map((a) => String(a)).join(" ")}`.slice(
            0,
            MAX_LOG_ENTRY,
          );
        executionLogs.push(msg);
        logs.push(msg);
      };

      try {
        // Extract declarations to run at context level for REPL persistence
        const { declarations, mainCode } = extractDeclarations(code);

        if (declarations.length > 0) {
          const MAX_DECL_LENGTH = 100_000;
          const declCode = declarations.join("\n");
          if (declCode.length > MAX_DECL_LENGTH) {
            throw new Error("Declaration script too large");
          }
          const declScript = new vm.Script(declCode);
          declScript.runInContext(vmContext);
        }

        // Wrap main code in async IIFE for proper async handling
        const wrappedCode = `
          (async () => {
            var __result__;
            ${wrapCodeForReturn(mainCode)}
            return __result__;
          })()
        `;

        const script = new vm.Script(wrappedCode);

        const resultPromise = script.runInContext(vmContext, {
          timeout: timeoutMs,
          displayErrors: true,
        }) as Promise<unknown>;

        // Race against timeout for async resolution
        let timeoutId: ReturnType<typeof setTimeout> | undefined;
        const timeoutPromise = new Promise((_, reject) => {
          timeoutId = setTimeout(
            () =>
              reject(new Error(`Execution timeout after ${timeoutMs}ms`)),
            timeoutMs,
          );
        });

        try {
          const result = await Promise.race([
            resultPromise,
            timeoutPromise,
          ]);
          return { result, logs: executionLogs };
        } finally {
          if (timeoutId) clearTimeout(timeoutId);
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : String(err);
        return { result: null, logs: executionLogs, error: errorMessage };
      } finally {
        // Restore original console functions
        consoleImpl.log = originalLog;
        consoleImpl.error = originalError;
        consoleImpl.warn = originalWarn;
        // Cap persistent logs
        if (logs.length > maxLogs) {
          logs.splice(0, logs.length - maxLogs);
        }
      }
    },

    getMemory(): unknown[] {
      return [...memory];
    },

    dispose(): void {
      disposed = true;
      logs.length = 0;
      memory.length = 0;
    },
  };
}
