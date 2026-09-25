import { CircuitBreaker, CircuitOpenError, CircuitState } from '../common/circuit-breaker';

describe('CircuitBreaker', () => {
  const options = { failureThreshold: 3, resetTimeoutMs: 200, callTimeoutMs: 50 };

  it('stays CLOSED while calls succeed', async () => {
    const breaker = new CircuitBreaker('test', options);
    for (let i = 0; i < 5; i++) {
      await breaker.execute(() => Promise.resolve('ok'));
    }
    expect(breaker.getState()).toBe(CircuitState.CLOSED);
  });

  it('trips OPEN after N consecutive failures and fails fast', async () => {
    const breaker = new CircuitBreaker('test', options);
    const fail = () => Promise.reject(new Error('boom'));

    for (let i = 0; i < options.failureThreshold; i++) {
      await expect(breaker.execute(fail)).rejects.toThrow('boom');
    }
    expect(breaker.getState()).toBe(CircuitState.OPEN);

    // Next call must fail fast with CircuitOpenError and NOT invoke fn again.
    const spy = jest.fn(fail);
    await expect(breaker.execute(spy)).rejects.toBeInstanceOf(CircuitOpenError);
    expect(spy).not.toHaveBeenCalled();
  });

  it('a successful call resets the consecutive-failure counter', async () => {
    const breaker = new CircuitBreaker('test', options);
    await expect(breaker.execute(() => Promise.reject(new Error('x')))).rejects.toThrow();
    await expect(breaker.execute(() => Promise.reject(new Error('x')))).rejects.toThrow();
    // One fewer than threshold so far — a success now should reset the streak.
    await breaker.execute(() => Promise.resolve('ok'));

    await expect(breaker.execute(() => Promise.reject(new Error('x')))).rejects.toThrow();
    await expect(breaker.execute(() => Promise.reject(new Error('x')))).rejects.toThrow();
    // Still only 2 consecutive failures since the reset — circuit should remain CLOSED.
    expect(breaker.getState()).toBe(CircuitState.CLOSED);
  });

  it('transitions OPEN -> HALF_OPEN after the reset timeout, then CLOSED on trial success', async () => {
    const breaker = new CircuitBreaker('test', options);
    for (let i = 0; i < options.failureThreshold; i++) {
      await expect(breaker.execute(() => Promise.reject(new Error('boom')))).rejects.toThrow();
    }
    expect(breaker.getState()).toBe(CircuitState.OPEN);

    await new Promise((r) => setTimeout(r, options.resetTimeoutMs + 20));
    expect(breaker.getState()).toBe(CircuitState.HALF_OPEN);

    await breaker.execute(() => Promise.resolve('recovered'));
    expect(breaker.getState()).toBe(CircuitState.CLOSED);
  });

  it('re-trips OPEN if the HALF_OPEN trial call fails', async () => {
    const breaker = new CircuitBreaker('test', options);
    for (let i = 0; i < options.failureThreshold; i++) {
      await expect(breaker.execute(() => Promise.reject(new Error('boom')))).rejects.toThrow();
    }
    await new Promise((r) => setTimeout(r, options.resetTimeoutMs + 20));
    expect(breaker.getState()).toBe(CircuitState.HALF_OPEN);

    await expect(breaker.execute(() => Promise.reject(new Error('still broken')))).rejects.toThrow();
    expect(breaker.getState()).toBe(CircuitState.OPEN);
  });

  it('treats a call exceeding callTimeoutMs as a failure', async () => {
    const breaker = new CircuitBreaker('test', options);
    const slow = () => new Promise((resolve) => setTimeout(resolve, options.callTimeoutMs + 100));
    await expect(breaker.execute(slow)).rejects.toThrow(/timed out/);
  });
});
