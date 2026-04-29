export class WingsDecodeError extends Error {
  readonly cause?: unknown;

  constructor(message: string, options?: { readonly cause?: unknown }) {
    super(message);
    this.name = "WingsDecodeError";
    this.cause = options?.cause;
  }
}
