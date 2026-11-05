import type { DestinationStream } from 'pino';

/** A pino destination that keeps every line, so tests can assert on real log output. */
export class LogCapture implements DestinationStream {
  readonly lines: string[] = [];

  write(chunk: string): void {
    this.lines.push(...chunk.split('\n').filter(Boolean));
  }

  /** Every line parsed as JSON. Throws if any line is not JSON. */
  entries(): Record<string, unknown>[] {
    return this.lines.map((line) => JSON.parse(line) as Record<string, unknown>);
  }

  get text(): string {
    return this.lines.join('\n');
  }
}
