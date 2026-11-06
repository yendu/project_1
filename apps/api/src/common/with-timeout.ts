/** Rejects with a `TimeoutError` if the promise hasn't settled within the time limit. */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  const signal = AbortSignal.timeout(ms);
  const timedOut = new Promise<never>((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(signal.reason), { once: true });
  });
  return Promise.race([promise, timedOut]);
}
