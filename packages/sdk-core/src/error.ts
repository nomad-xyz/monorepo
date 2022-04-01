export class FailedHomeError extends Error {
  constructor(msg: string) {
    super(msg);
    Object.setPrototypeOf(this, FailedHomeError.prototype);
  }
}
