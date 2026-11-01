import { Injectable } from '@nestjs/common';

export interface HealthResponse {
  status: 'ok';
}

@Injectable()
export class HealthService {
  /** Liveness only: the process is up and serving requests. No dependencies are checked. */
  check(): HealthResponse {
    return { status: 'ok' };
  }
}
