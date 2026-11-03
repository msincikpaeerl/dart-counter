import { describe, expect, it } from 'vitest';
import { retry } from '../../src/server/retry.js';

describe('retry', () => {
  it('returns the result once the task succeeds', async () => {
    let calls = 0;
    const result = await retry(
      async () => {
        calls++;
        if (calls < 3) throw new Error('database not ready');
        return 'ok';
      },
      { delayMs: 1 },
    );
    expect(result).toBe('ok');
    expect(calls).toBe(3);
  });

  it('throws the last error after the allowed attempts', async () => {
    let calls = 0;
    await expect(
      retry(
        async () => {
          calls++;
          throw new Error(`failure ${calls}`);
        },
        { attempts: 2, delayMs: 1 },
      ),
    ).rejects.toThrow('failure 2');
    expect(calls).toBe(2);
  });
});
