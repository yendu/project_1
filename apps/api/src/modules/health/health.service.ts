import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { HealthRepository } from './health.repository.js';

export interface HealthResponse {
  status: 'ok';
}

// Below the usual load balancer probe timeout, and well below the pool's 5 s connect timeout.
const READINESS_TIMEOUT_MS = 2_000;

@Injectable()
export class HealthService {
  constructor(private readonly healthRepository: HealthRepository) {}

  /** Liveness only: the process is up and serving requests. No dependencies are checked. */
  check(): HealthResponse {
    return { status: 'ok' };
  }

  /** Readiness: the database answers within the time limit. */
  async ready(): Promise<HealthResponse> {
    try {
      await withTimeout(this.healthRepository.ping(), READINESS_TIMEOUT_MS);
    } catch (error) {
      // The client gets a generic 503; the cause goes to the server log.
      throw new ServiceUnavailableException('Database is not ready', { cause: error });
    }
    return { status: 'ok' };
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  const signal = AbortSignal.timeout(ms);
  const timedOut = new Promise<never>((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(signal.reason), { once: true });
  });
  return Promise.race([promise, timedOut]);
}
