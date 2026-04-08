/**
 * Generic keyed session manager with hash-based staleness detection
 * and bounded capacity with LRU eviction.
 *
 * Parameterized over session type T — works with Sandbox, SolverSession,
 * or any disposable resource.
 */

import { createHash } from "node:crypto";

export interface SessionManager<T> {
  /** Get existing session or create a new one. Recreates if contentHash changed. */
  getOrCreate(
    key: string,
    contentHash: string,
    factory: () => Promise<T>,
  ): Promise<T>;
  /** Get existing session (undefined if not found). */
  get(key: string): T | undefined;
  /** Dispose and remove a specific session. */
  clear(key: string): void;
  /** Dispose and remove all sessions. */
  clearAll(): void;
  /** List all active session keys. */
  listSessions(): string[];
}

export interface SessionManagerOptions<T> {
  /** Maximum number of cached sessions (default: 100). */
  maxSessions?: number;
  /** Called when a session is evicted or cleared. */
  dispose?: (session: T) => void;
  /** Maximum key length (default: 4096). */
  maxKeyLength?: number;
}

interface SessionEntry<T> {
  session: T;
  contentHash: string;
  createdAt: Date;
}

/**
 * Compute MD5 hash of content for change detection.
 */
export function hashContent(content: string): string {
  return createHash("md5").update(content).digest("hex");
}

/**
 * Create a generic session manager.
 *
 * @example
 * ```ts
 * const sessions = createSessionManager<Sandbox>({
 *   maxSessions: 100,
 *   dispose: (s) => s.dispose(),
 * });
 *
 * const sandbox = await sessions.getOrCreate(
 *   "/path/to/file.txt",
 *   hashContent(fileContent),
 *   () => createSandbox(fileContent, { builtins: [...] }),
 * );
 * ```
 */
export function createSessionManager<T>(
  options: SessionManagerOptions<T> = {},
): SessionManager<T> {
  const {
    maxSessions = 100,
    dispose,
    maxKeyLength = 4096,
  } = options;

  const sessions = new Map<string, SessionEntry<T>>();

  function disposeEntry(entry: SessionEntry<T>): void {
    dispose?.(entry.session);
  }

  return {
    async getOrCreate(
      key: string,
      contentHash: string,
      factory: () => Promise<T>,
    ): Promise<T> {
      if (key.length > maxKeyLength) {
        throw new Error(
          `Session key too long (${key.length} chars, max ${maxKeyLength})`,
        );
      }

      const existing = sessions.get(key);
      if (existing) {
        if (existing.contentHash !== contentHash) {
          // Content changed — dispose old, create new
          disposeEntry(existing);
          sessions.delete(key);
        } else {
          return existing.session;
        }
      }

      const session = await factory();

      // Evict oldest if at capacity
      if (sessions.size >= maxSessions) {
        const oldest = sessions.keys().next().value;
        if (oldest !== undefined) {
          const oldEntry = sessions.get(oldest);
          if (oldEntry) disposeEntry(oldEntry);
          sessions.delete(oldest);
        }
      }

      sessions.set(key, {
        session,
        contentHash,
        createdAt: new Date(),
      });

      return session;
    },

    get(key: string): T | undefined {
      return sessions.get(key)?.session;
    },

    clear(key: string): void {
      const entry = sessions.get(key);
      if (entry) {
        disposeEntry(entry);
        sessions.delete(key);
      }
    },

    clearAll(): void {
      for (const entry of sessions.values()) {
        disposeEntry(entry);
      }
      sessions.clear();
    },

    listSessions(): string[] {
      return Array.from(sessions.keys());
    },
  };
}
