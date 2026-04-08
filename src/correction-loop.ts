/**
 * Generic bounded correction loop.
 *
 * Submit input -> check result -> if error, ask fixer to patch -> resubmit.
 * Tracks full history of attempts. Parameterized over input and result types.
 */

/** A function that takes a broken input + error and returns a patched input (or null to give up). */
export type Fixer<I, R> = (
  input: I,
  error: string,
  round: number,
  result?: R,
) => Promise<I | null>;

/** A function that submits input and returns a result. */
export type Submitter<I, R> = (input: I) => Promise<R>;

/** Predicate to check if a result is an error that should trigger correction. */
export type ErrorCheck<R> = (result: R) => string | null;

/** Record of a single correction attempt. */
export interface CorrectionAttempt<I, R> {
  round: number;
  input: I;
  result: R;
}

/** Result of the full correction loop. */
export interface CorrectionResult<I, R> {
  /** Final result (may be success or the last error). */
  result: R;
  /** Whether the loop converged to a valid result. */
  converged: boolean;
  /** Number of rounds taken. */
  rounds: number;
  /** Full history of attempts. */
  history: CorrectionAttempt<I, R>[];
}

export interface CorrectionLoopOptions {
  maxRounds?: number;
}

const DEFAULT_MAX_ROUNDS = 5;

/**
 * Run a bounded correction loop.
 *
 * The loop stops when:
 * - The submitter returns a non-error result (converged = true)
 * - The fixer returns null (gives up, converged = false)
 * - Max rounds reached (converged = false)
 *
 * @param initialInput - The first input to submit.
 * @param submit - Submits input, returns a result.
 * @param isError - Checks if a result is an error. Returns error message string, or null if OK.
 * @param fixer - Given a failed input + error, returns a patched input or null.
 * @param options - { maxRounds } (default: 5).
 *
 * @example
 * ```ts
 * const result = await correctionLoop(
 *   initialSpec,
 *   (spec) => solver.solve(spec),
 *   (r) => r.status === "error" ? r.error : null,
 *   (spec, error, round) => llmFix(spec, error),
 * );
 * ```
 */
export async function correctionLoop<I, R>(
  initialInput: I,
  submit: Submitter<I, R>,
  isError: ErrorCheck<R>,
  fixer: Fixer<I, R>,
  options: CorrectionLoopOptions = {},
): Promise<CorrectionResult<I, R>> {
  const maxRounds = options.maxRounds ?? DEFAULT_MAX_ROUNDS;
  const history: CorrectionAttempt<I, R>[] = [];

  let currentInput = initialInput;

  for (let round = 1; round <= maxRounds; round++) {
    const result = await submit(currentInput);

    history.push({ round, input: currentInput, result });

    // Non-error = converged
    const errorMsg = isError(result);
    if (errorMsg === null) {
      return { result, converged: true, rounds: round, history };
    }

    // Last round — don't try to fix
    if (round === maxRounds) {
      return { result, converged: false, rounds: round, history };
    }

    // Ask fixer to patch
    const patched = await fixer(currentInput, errorMsg, round, result);
    if (patched === null) {
      return { result, converged: false, rounds: round, history };
    }

    currentInput = patched;
  }

  // Should not reach here, but satisfy TypeScript
  const lastAttempt = history[history.length - 1];
  return {
    result: lastAttempt.result,
    converged: false,
    rounds: history.length,
    history,
  };
}
