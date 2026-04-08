/**
 * Construct a safe globals object for vm.createContext().
 *
 * Provides standard JS built-ins with:
 * - Frozen Object proxy (blocks prototype pollution via __proto__ keys)
 * - Constructor chain escape prevention
 * - eval() blocked
 */

/**
 * Build a safe globals record suitable for vm.createContext().
 *
 * Returns a plain object with locked-down standard builtins.
 * Pass the result to vm.createContext() directly or merge additional
 * globals before creating the context.
 */
export function buildSafeGlobals(): Record<string, unknown> {
  const globals: Record<string, unknown> = {
    JSON,
    Math,
    Date,
    Array,
    Object: Object.freeze(
      Object.create(null, {
        keys: { value: Object.keys, enumerable: true },
        values: { value: Object.values, enumerable: true },
        entries: { value: Object.entries, enumerable: true },
        freeze: { value: Object.freeze, enumerable: true },
        getOwnPropertyNames: {
          value: Object.getOwnPropertyNames,
          enumerable: true,
        },
        hasOwn: { value: Object.hasOwn, enumerable: true },
        is: { value: Object.is, enumerable: true },
        create: { value: Object.create, enumerable: true },
      }),
    ),
    String,
    Number,
    Boolean,
    RegExp,
    Map,
    Set,
    Promise,
    Symbol,
    parseInt,
    parseFloat,
    isNaN: Number.isNaN,
    isFinite: Number.isFinite,
    encodeURIComponent,
    decodeURIComponent,
    eval: () => {
      throw new Error("eval is not allowed in sandbox");
    },
  };

  // Prevent constructor chain escape: this.constructor.constructor("return process")()
  Object.defineProperty(globals, "constructor", {
    value: undefined,
    writable: false,
    configurable: false,
  });

  return globals;
}
