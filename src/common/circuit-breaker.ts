import { Logger } from '@nestjs/common';

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export class CircuitOpenError extends Error {
  constructor(circuitName: string) {
    super(`Circuit "${circuitName}" is OPEN — failing fast without calling downstream`);
    this.name = 'CircuitOpenError';
  }
}

export interface CircuitBreakerOptions {
  /** Consecutive failures before the circuit trips OPEN. */
  failureThreshold: number;
  /** How long (ms) the circuit stays OPEN before allowing a single trial call (HALF_OPEN). */
  resetTimeoutMs: number;
  /** Per-call timeout (ms). A call exceeding this counts as a failure. */
  callTimeoutMs: number;
}

/**
 * Minimal, dependency-free Circuit Breaker used to protect calls to the two
 * mocked upstream systems (Sales System API / Service System API).
 *
 * Mirrors the Circuit Breaker + timeout pattern used in production on the
 * Chorus platform: three states (CLOSED -> OPEN -> HALF_OPEN -> CLOSED),
 * a consecutive-failure threshold to trip, and a cool-down window before a
 * single "trial" request is allowed through again.
 */
export class CircuitBreaker {
  private readonly logger = new Logger(`CircuitBreaker:${this.name}`);
  private state: CircuitState = CircuitState.CLOSED;
  private consecutiveFailures = 0;
  private openedAt = 0;

  constructor(
    private readonly name: string,
    private readonly options: CircuitBreakerOptions,
  ) {}

  getState(): CircuitState {
    if (
      this.state === CircuitState.OPEN &&
      Date.now() - this.openedAt >= this.options.resetTimeoutMs
    ) {
      this.state = CircuitState.HALF_OPEN;
      this.logger.warn(`Cool-down elapsed — transitioning to HALF_OPEN (trial request allowed)`);
    }
    return this.state;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    const state = this.getState();
    if (state === CircuitState.OPEN) {
      throw new CircuitOpenError(this.name);
    }

    try {
      const result = await this.withTimeout(fn());
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }

  private withTimeout<T>(promise: Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Call to "${this.name}" timed out after ${this.options.callTimeoutMs}ms`));
      }, this.options.callTimeoutMs);
      promise
        .then((v) => {
          clearTimeout(timer);
          resolve(v);
        })
        .catch((e) => {
          clearTimeout(timer);
          reject(e);
        });
    });
  }

  private onSuccess() {
    if (this.state === CircuitState.HALF_OPEN) {
      this.logger.log(`Trial request succeeded — closing circuit`);
    }
    this.consecutiveFailures = 0;
    this.state = CircuitState.CLOSED;
  }

  private onFailure() {
    this.consecutiveFailures += 1;
    if (this.state === CircuitState.HALF_OPEN) {
      this.trip('trial request failed while HALF_OPEN');
      return;
    }
    if (this.consecutiveFailures >= this.options.failureThreshold) {
      this.trip(`${this.consecutiveFailures} consecutive failures reached threshold`);
    }
  }

  private trip(reason: string) {
    this.state = CircuitState.OPEN;
    this.openedAt = Date.now();
    this.logger.error(`Circuit tripped OPEN (${reason})`);
  }
}
