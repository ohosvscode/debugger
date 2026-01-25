import type { Connection } from './connection'
import { Adapter } from './adapter'
import { JsonException } from './errors'
import { JSONPromiseify } from './utils'

export abstract class BaseAdapter {
  constructor(protected readonly connection: Connection) {}

  getConnection(): Connection {
    return this.connection
  }

  protected async handleOnNotification<Id extends number = number, Params = unknown>(message: unknown): Promise<Adapter.OptionalNotification<Id, Params> | JsonException | null> {
    try {
      const data = typeof message === 'string' ? await JSONPromiseify.parse(message) : message
      if (Adapter.Response.is(data)) {
        return null
      }
      else if (Adapter.Error.is(data)) {
        return null
      }
      else if (Adapter.Notification.is(data)) {
        return data as Adapter.Notification<Id, Params>
      }
      else if (Adapter.OptionalNotification.is(data)) {
        return data as Adapter.OptionalNotification<Id, Params>
      }
      else {
        return new JsonException(`Unknown JSON-RPC response.`, JsonException.Type.UNKNOWN_JSONRPC_RESPONSE, message)
      }
    }
    catch (error) {
      return new JsonException(`Failed to parse JSON.`, JsonException.Type.PARSE_ERROR, {
        error,
        message,
      })
    }
  }

  protected async handleOnRequest<Id extends number = number, Result = unknown, ErrorData = unknown>(message: unknown): Promise<Adapter.Response<Id, Result> | Adapter.Error<Id, ErrorData> | JsonException | null> {
    try {
      const data = typeof message === 'string' ? await JSONPromiseify.parse(message) : message
      if (Adapter.Response.is(data)) {
        return data as Adapter.Response<Id, Result>
      }
      else if (Adapter.Error.is(data)) {
        return data as Adapter.Error<Id, ErrorData>
      }
      else if (Adapter.Notification.is(data)) {
        return null
      }
      else {
        return new JsonException(`Unknown JSON-RPC request.`, JsonException.Type.UNKNOWN_JSONRPC_RESPONSE, message)
      }
    }
    catch (error) {
      return new JsonException(`Failed to parse JSON.`, JsonException.Type.PARSE_ERROR, {
        error,
        message,
      })
    }
  }

  protected async handleSendRequest<Id extends number = number, Result = unknown, ErrorData = unknown>(message: unknown): Promise<Adapter.Response<Id, Result> | Adapter.Error<Id, ErrorData> | null> {
    try {
      const data = typeof message === 'string' ? await JSONPromiseify.parse(message) : message
      if (Adapter.Response.is(data)) {
        return data as Adapter.Response<Id, Result>
      }
      else if (Adapter.Error.is(data)) {
        return data as Adapter.Error<Id, ErrorData>
      }
      else {
        return null
      }
    }
    catch {
      return null
    }
  }
}
