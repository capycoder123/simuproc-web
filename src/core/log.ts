/** Ring buffer of log lines with a fixed capacity (2000 in the original's spirit of a bounded panel). */
export class LogBuffer {
  readonly cap: number;
  private buf: string[];
  private head = 0;
  private count = 0;

  constructor(cap = 2000) {
    this.cap = cap;
    this.buf = new Array<string>(cap);
  }

  push(line: string): void {
    if (this.count < this.cap) {
      this.buf[(this.head + this.count) % this.cap] = line;
      this.count++;
    } else {
      this.buf[this.head] = line;
      this.head = (this.head + 1) % this.cap;
    }
  }

  get length(): number {
    return this.count;
  }

  /** Most recent line, or an empty string. */
  last(): string {
    if (this.count === 0) return '';
    return this.buf[(this.head + this.count - 1) % this.cap];
  }

  /** Lines in chronological order (a copy). */
  lines(): string[] {
    const out = new Array<string>(this.count);
    for (let i = 0; i < this.count; i++) out[i] = this.buf[(this.head + i) % this.cap];
    return out;
  }

  clear(): void {
    this.head = 0;
    this.count = 0;
  }
}
