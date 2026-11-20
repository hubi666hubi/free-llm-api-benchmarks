import { IClock, IIdGenerator } from "./interfaces";

export class SystemClock implements IClock {
  now(): Date {
    return new Date();
  }
  timestamp(): number {
    return Date.now();
  }
}

export class DefaultIdGenerator implements IIdGenerator {
  private counter = 0;

  generateId(prefix: string = "id"): string {
    this.counter = (this.counter + 1) % 1_000_000;
    const rand = Math.random().toString(36).substring(2, 7);
    return `${prefix}-${Date.now()}-${rand}-${this.counter}`;
  }
}
