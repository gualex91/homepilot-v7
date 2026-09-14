const transient = new Set([502, 503, 504]);
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// Buffer the whole response inside the timeout. Repeat only safe reads, never a write.
export async function budgetUpstream(url, options, dependencies = {}) {
  const request = dependencies.fetch || fetch;
  const signal = dependencies.timeout || (() => AbortSignal.timeout(6000));
  const pause = dependencies.pause || delay;
  const safeRead = ['GET', 'HEAD'].includes(options.method);
  const attempts = safeRead ? 2 : 1;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await request(url, {...options, signal: signal()});
      const text = await response.text();
      // Respect a provider's request to wait longer; leave that retry to the user.
      const retryAfter = response.headers.get('retry-after');
      const retryDelay = retryAfter === null ? 300 : Number(retryAfter) * 1000;
      if (attempt < attempts && transient.has(response.status) && Number.isFinite(retryDelay) && retryDelay >= 0 && retryDelay <= 1000) {
        await pause(retryDelay);
        continue;
      }
      return {response, text, attempts: attempt};
    } catch (error) {
      const timeout = error?.name === 'TimeoutError' || error?.name === 'AbortError';
      const network = error instanceof TypeError;
      if (attempt < attempts && (timeout || network)) { await pause(300); continue; }
      throw error;
    }
  }
}
