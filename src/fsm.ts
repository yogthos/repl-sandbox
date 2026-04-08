/**
 * Generic finite state machine engine.
 *
 * Runs a declarative state machine specification. Each state has a handler
 * function and an ordered list of transitions (predicate -> next state).
 * First matching transition wins. Supports async handlers.
 */

export type Predicate<T> = (ctx: T) => boolean;

export interface State<T> {
  handler: (ctx: T) => T | Promise<T>;
  transitions: Array<[string, Predicate<T>]>;
}

export interface FSMSpec<T> {
  initial: string;
  terminal: Set<string>;
  states: Map<string, State<T>>;
  maxIterations?: number;
}

export interface RunOptions {
  onTransition?: (from: string, to: string) => void;
}

const DEFAULT_MAX_ITERATIONS = 1000;

export class FSMEngine<T> {
  async run(spec: FSMSpec<T>, ctx: T, options?: RunOptions): Promise<T> {
    let current = spec.initial;
    const maxIter = spec.maxIterations ?? DEFAULT_MAX_ITERATIONS;

    for (let i = 0; i < maxIter; i++) {
      const state = spec.states.get(current);
      if (!state) {
        throw new Error(`FSM: unknown state "${current}"`);
      }

      ctx = await state.handler(ctx);

      if (spec.terminal.has(current)) {
        return ctx;
      }

      let nextState: string | null = null;
      for (const [target, predicate] of state.transitions) {
        if (predicate(ctx)) {
          nextState = target;
          break;
        }
      }

      if (nextState === null) {
        throw new Error(
          `FSM: no matching transition from state "${current}"`,
        );
      }

      options?.onTransition?.(current, nextState);
      current = nextState;
    }

    throw new Error(
      `FSM: max iterations (${maxIter}) exceeded in state "${current}"`,
    );
  }
}
