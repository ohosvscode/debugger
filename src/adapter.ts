import type { Connection } from './connection'
import type { JsonException } from './errors'
import type { Awaitable, Disposable } from './types'

export interface Adapter {
  /** Get the connection. */
  getConnection(): Connection
  /** Get the debugger adapter. */
  getDebuggerAdapter(): Promise<Adapter.Debugger>
  /** Get the runtime adapter. */
  getRuntimeAdapter(): Promise<Adapter.Runtime>
  /**
   * Send a request.
   *
   * @see https://jsonrpc.org/specification#request_object
   * @throws {JsonException} If the request is not a valid JSON.
   * @throws {unknown} If the notification fails to send.
   */
  sendRequest<Id extends number = number, Params = unknown, Result = unknown, ErrorData = unknown>(request: Adapter.OptionalNotification<Id, Params>): Promise<Adapter.Response<Id, Result> | Adapter.Error<Id, ErrorData>>
  /**
   * Send a notification.
   *
   * @see https://jsonrpc.org/specification#notification
   * @throws {JsonException} If the notification is not a valid JSON.
   * @throws {unknown} If the notification fails to send.
   */
  sendNotification<Id extends number = number, Params = unknown>(notification: Adapter.OptionalNotification<Id, Params>): Promise<void>
  /**
   * Register a request listener.
   *
   * @param callback - The callback to call when a response is received.
   * @returns A disposable that can be used to unregister the listener.
   */
  onRequest<Id extends number = number, Result = unknown, ErrorData = unknown>(callback: (response: Adapter.Response<Id, Result> | Adapter.Error<Id, ErrorData> | JsonException) => void): Disposable
  /**
   * Register a notification listener.
   *
   * @param callback - The callback to call when a notification is received.
   * @returns A disposable that can be used to unregister the listener.
   */
  onNotification<Id extends number = number, Params = unknown>(callback: (notification: Adapter.OptionalNotification<Id, Params> | JsonException) => void): Disposable
}

export namespace Adapter {
  export interface Request<Id extends number = number, Params = unknown> {
    id: Id
    params: Params
  }

  export namespace Request {
    export function is(value: unknown): value is Adapter.Request {
      return typeof value === 'object' && value !== null && 'id' in value && 'params' in value
    }
  }

  export interface Notification<Id extends number = number, Params = unknown> extends Request<Id, Params> {
    method: string
  }

  export namespace Notification {
    export function is(value: unknown): value is Adapter.Notification {
      return Adapter.Request.is(value) && 'method' in value
    }
  }

  export interface OptionalRequest<Id extends number = number, Params = unknown> extends Omit<Adapter.Request<Id, Params>, 'id'> {
    id?: Id
  }

  export interface OptionalNotification<Id extends number = number, Params = unknown> extends Omit<Adapter.Notification<Id, Params>, 'id'> {
    id?: Id
  }

  export namespace OptionalNotification {
    export function is(value: unknown): value is Adapter.OptionalNotification {
      return typeof value === 'object'
        && value !== null
        && 'method' in value
        && typeof value.method === 'string'
        && 'params' in value
    }
  }

  export interface Response<Id extends number = number, Result = unknown> {
    id: Id
    result: Result
  }

  export namespace Response {
    export function is(value: unknown): value is Adapter.Response {
      return typeof value === 'object' && value !== null && 'id' in value && 'result' in value
    }
  }

  export interface ErrorDetail<Data = unknown> {
    code: number
    message: string
    data?: Data
  }

  export namespace ErrorDetail {
    export function is(value: unknown): value is Adapter.ErrorDetail {
      return typeof value === 'object' && value !== null && 'code' in value && 'message' in value && 'data' in value
    }
  }

  export interface Error<Id extends number = number, Data = unknown> {
    id: Id
    error: Adapter.ErrorDetail<Data>
  }

  export namespace Error {
    export function is(value: unknown): value is Adapter.Error {
      return typeof value === 'object' && value !== null && 'id' in value && 'error' in value && Adapter.ErrorDetail.is(value.error)
    }
  }

  export interface Factory<TAdapter extends Adapter = Adapter> extends Partial<Disposable> {
    onInitialize(connection: Connection, options: Connection.ResolvedOptions): Awaitable<TAdapter>
  }

  export interface Location {
    url: string
    lineNumber: number
    columnNumber: number
  }

  export interface Debugger extends Partial<Disposable> {
    enable<Id extends number = number>(request: Adapter.Debugger.Enable.Request<Id>): Promise<Adapter.Debugger.Enable.Response<Id> | Adapter.Error<Id>>
    disable<Id extends number = number>(request: Adapter.Debugger.Disable.Request<Id>): Promise<Adapter.Debugger.Disable.Response<Id> | Adapter.Error<Id>>
    removeBreakpointsByUrl<Id extends number = number>(request: Adapter.Debugger.RemoveBreakpointsByUrl.Request<Id>): Promise<Adapter.Debugger.RemoveBreakpointsByUrl.Response<Id> | Adapter.Error<Id>>
    getPossibleAndSetBreakpointByUrl<Id extends number = number>(request: Adapter.Debugger.GetPossibleAndSetBreakpointByUrl.Request<Id>): Promise<Adapter.Debugger.GetPossibleAndSetBreakpointByUrl.Response<Id> | Adapter.Error<Id>>
    saveAllPossibleBreakpoints<Id extends number = number>(request: Adapter.Debugger.SaveAllPossibleBreakpoints.Request<Id>): Promise<Adapter.Debugger.SaveAllPossibleBreakpoints.Response<Id> | Adapter.Error<Id>>
  }

  export interface Runtime {
    enable<Id extends number = number>(request: Adapter.Runtime.Enable.Request<Id>): Promise<Adapter.Runtime.Enable.Response<Id> | Adapter.Error<Id>>
    disable<Id extends number = number>(request: Adapter.Runtime.Disable.Request<Id>): Promise<Adapter.Runtime.Disable.Response<Id> | Adapter.Error<Id>>
    runIfWaitingForDebugger<Id extends number = number>(request: Adapter.Runtime.RunIfWaitingForDebugger.Request<Id>): Promise<Adapter.Runtime.RunIfWaitingForDebugger.Response<Id> | Adapter.Error<Id>>
  }

  export namespace Runtime {
    export namespace Disable {
      export interface Request<Id extends number = number> extends Adapter.OptionalRequest<Id, Record<never, never>> {}
      export interface Response<Id extends number = number> extends Adapter.Response<Id, Record<never, never>> {}
    }

    export namespace Enable {
      export interface Request<Id extends number = number> extends Adapter.OptionalRequest<Id, Record<never, never>> {}

      export interface Result {
        protocols: unknown[]
      }

      export interface Response<Id extends number = number> extends Adapter.Response<Id, Result> {}
    }

    export namespace RunIfWaitingForDebugger {
      export interface Request<Id extends number = number> extends Adapter.OptionalRequest<Id, Record<never, never>> {}

      export interface Response<Id extends number = number> extends Adapter.Response<Id, Record<never, never>> {}
    }
  }

  export namespace Debugger {
    export namespace Enable {
      export type Option = 'enableLaunchAccelerate'

      export interface Params {
        options: (Option | (string & {}))[]
        maxScriptsCacheSize: number
      }

      export interface Request<Id extends number = number> extends Adapter.OptionalRequest<Id, Params> {}

      export type Protocol = 'removeBreakpointsByUrl' | 'setMixedDebugEnabled' | 'replyNativeCalling' | 'getPossibleAndSetBreakpointByUrl' | 'dropFrame' | 'setNativeRange' | 'resetSingleStepper' | 'callFunctionOn' | 'smartStepInto' | 'saveAllPossibleBreakpoints' | 'setSymbolicBreakpoints' | 'removeSymbolicBreakpoints'

      export interface Result {
        debuggerId: string
        protocols: (Protocol | (string & {}))[]
      }

      export interface Response<Id extends number = number> extends Adapter.Response<Id, Result> {}
    }

    export namespace Disable {
      export interface Request<Id extends number = number> extends Adapter.OptionalRequest<Id, Record<never, never>> {}
      export interface Response<Id extends number = number> extends Adapter.Response<Id, Record<never, never>> {}
    }

    export namespace SaveAllPossibleBreakpoints {
      export interface Params {
        locations: Record<never, never>
      }

      export interface Request<Id extends number = number> extends Adapter.OptionalRequest<Id, Params> {}
      export interface Response<Id extends number = number> extends Adapter.Response<Id, Record<never, never>> {}
    }

    export namespace GetPossibleAndSetBreakpointByUrl {
      export interface Params {
        locations: Adapter.Location[]
      }

      export interface Request<Id extends number = number> extends Adapter.OptionalRequest<Id, Params> {}

      export interface Result {
        breakpoints: Adapter.Location[]
      }

      export interface Response<Id extends number = number> extends Adapter.Response<Id, Result> {}
    }

    export namespace RemoveBreakpointsByUrl {
      export interface Params {
        url: string
      }

      export interface Request<Id extends number = number> extends Adapter.OptionalRequest<Id, Params> {}

      export interface Response<Id extends number = number> extends Adapter.Response<Id, Record<never, never>> {}
    }
  }
}
