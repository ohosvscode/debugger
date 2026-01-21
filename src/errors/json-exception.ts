import { BaseException } from './base-exception'

export class JsonException extends BaseException {
  constructor(public readonly message: string, public readonly type: JsonException.Type, public readonly cause?: unknown) {
    super(message)
  }
}

export namespace JsonException {
  export enum Type {
    PARSE_ERROR = 'parse_error',
    STRINGIFY_ERROR = 'stringify_error',
    UNKNOWN_JSONRPC_RESPONSE = 'unknown_jsonrpc_response',
  }

  export function isJsonException(value: unknown): value is JsonException {
    return BaseException.isBaseException(value) && value instanceof JsonException
  }
}
