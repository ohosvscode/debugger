import type { Connection } from './connection'
import type { Awaitable, Disposable } from './types'

export interface Adapter {
  /** Get the connection. */
  getConnection(): Connection
  /** Get the debugger adapter. */
  getDebuggerAdapter(): Promise<Adapter.Debugger>
  /** Get the runtime adapter. */
  getRuntimeAdapter(): Promise<Adapter.Runtime>
  /** Send a request to the adapter. @see https://jsonrpc.org/specification#request_object */
  sendRequest<Id extends number = number, Params = unknown, Result = unknown, ErrorData = unknown>(request: Adapter.OptionalNotification<Id, Params>): Promise<Adapter.Response<Id, Result> | Adapter.Error<Id, ErrorData>>
  /** Send a notification to the adapter. @see https://jsonrpc.org/specification#notification */
  sendNotification<Id extends number = number, Params = unknown>(notification: Adapter.OptionalNotification<Id, Params>): Promise<void>
}

export namespace Adapter {
  export interface Request<Id extends number = number, Params = unknown> {
    id: Id
    params: Params
  }

  export interface Notification<Id extends number = number, Params = unknown> extends Request<Id, Params> {
    method: string
  }

  export interface OptionalRequest<Id extends number = number, Params = unknown> extends Omit<Adapter.Request<Id, Params>, 'id'> {
    id?: Id
  }

  export interface OptionalNotification<Id extends number = number, Params = unknown> extends Omit<Adapter.Notification<Id, Params>, 'id'> {
    id?: Id
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

  export interface Factory extends Partial<Disposable> {
    onInitialize(connection: Connection, options: Connection.ResolvedOptions): Awaitable<Adapter>
  }

  export interface Location {
    url: string
    lineNumber: number
    columnNumber: number
  }

  export interface Debugger extends Partial<Disposable> {
    enable<Id extends number = number>(request: Adapter.Debugger.Enable.Request<Id>): Promise<Adapter.Debugger.Enable.Response<Id> | Adapter.Error<Id>>
    disable<Id extends number = number>(request: Adapter.Debugger.Disable.Request<Id>): Promise<void>
    removeBreakpointsByUrl<Id extends number = number>(request: Adapter.Debugger.RemoveBreakpointsByUrl.Request<Id>): Promise<Adapter.Debugger.RemoveBreakpointsByUrl.Response<Id> | Adapter.Error<Id>>
    getPossibleAndSetBreakpointByUrl<Id extends number = number>(request: Adapter.Debugger.GetPossibleAndSetBreakpointByUrl.Request<Id>): Promise<Adapter.Debugger.GetPossibleAndSetBreakpointByUrl.Response<Id> | Adapter.Error<Id>>
  }

  export interface Runtime {
    enable<Id extends number = number>(request: Adapter.Runtime.Enable.Request<Id>): Promise<Adapter.Runtime.Enable.Response<Id> | Adapter.Error<Id>>
  }
}

export namespace Adapter.Runtime.Enable {
  export interface Request<Id extends number = number> extends Adapter.OptionalRequest<Id, void> {}

  export interface Result {
    protocols: unknown[]
  }

  export interface Response<Id extends number = number> extends Adapter.Response<Id, Result> {}
}

export namespace Adapter.Debugger.Enable {
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

export namespace Adapter.Debugger.Disable {
  export interface Request<Id extends number = number> extends Adapter.OptionalRequest<Id, Record<never, never>> {}
}

export namespace Adapter.Debugger.GetPossibleAndSetBreakpointByUrl {
  export interface Params {
    locations: Adapter.Location[]
  }

  export interface Request<Id extends number = number> extends Adapter.OptionalRequest<Id, Params> {}

  export interface Result {
    breakpoints: Adapter.Location[]
  }

  export interface Response<Id extends number = number> extends Adapter.Response<Id, Result> {}
}

export namespace Adapter.Debugger.RemoveBreakpointsByUrl {
  export interface Params {
    url: string
  }

  export interface Request<Id extends number = number> extends Adapter.OptionalRequest<Id, Params> {}

  export interface Response<Id extends number = number> extends Adapter.Response<Id, void> {}
}
