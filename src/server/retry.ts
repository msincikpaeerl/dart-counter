/**
 * Runs `task` until it succeeds, waiting `delayMs` between attempts.
 * Used at startup so the app waits for the database to accept connections.
 * Throws the last error after `attempts` failures.
 */
export async function retry<T>(
  task: () => Promise<T>,
  options: {
    attempts?: number;
    delayMs?: number;
    onRetry?: (error: unknown, attempt: number) => void;
  } = {},
): Promise<T> {
  const attempts = options.attempts ?? 30;
  const delayMs = options.delayMs ?? 2000;
  for (let attempt = 1; ; attempt++) {
    try {
      return await task();
    } catch (error) {
      if (attempt >= attempts) throw error;
      options.onRetry?.(error, attempt);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}
