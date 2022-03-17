import DeployContext from './DeployContext';

export default abstract class Contracts<T> {
  protected _data: Partial<T>;
  protected context: DeployContext;
  protected abstract keys: ReadonlyArray<keyof T>;
  protected domain: string;

  constructor(context: DeployContext, domain: string, data?: T) {
    this._data = data ?? {};
    this.context = context;
    this.domain = domain;
  }

  get data(): Readonly<Partial<T>> {
    return this._data;
  }

  abstract recordStartBlock(): Promise<void>;

  checkKeys(): void {
    for (const key of this.keys) {
      if (!this.data[key]) {
        throw new Error(`Missing key ${key}`);
      }
    }
  }

  complete(): T {
    this.checkKeys();
    return this.data as T;
  }

  // alias for complete
  toObject(): T {
    return this.complete();
  }

  toJson(): string {
    return JSON.stringify(this.toObject());
  }

  toJsonPretty(): string {
    return JSON.stringify(this.toObject(), null, 2);
  }
}
