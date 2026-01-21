export abstract class BaseException extends Error {
  constructor(public readonly message: string) {
    super(message)
  }
}

export namespace BaseException {
  export function isBaseException(value: unknown): value is BaseException {
    return value instanceof BaseException
  }
}
