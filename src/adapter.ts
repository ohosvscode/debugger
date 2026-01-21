import type { Connection } from './connection'
import type { Awaitable, Disposable } from './types'

export interface Adapter extends Partial<Disposable> {
  onInitialize?(options: Connection.ResolvedOptions): Awaitable<void>
  /** Get the debugger adapter. */
  getDebuggerAdapter(): Awaitable<Adapter.Debugger>
  /** Get the runtime adapter. */
  getRuntimeAdapter(): Awaitable<Adapter.Runtime>
}

export namespace Adapter {
  export interface Request<Id extends number = number, Params = unknown> {
    id: Id
    params: Params
  }

  export interface Response<Id extends number = number, Result = unknown> {
    id: Id
    result: Result
  }

  export interface Location {
    url: string
    lineNumber: number
    columnNumber: number
  }

  export interface Debugger {
    enable<Id extends number = number>(request: Adapter.Debugger.Enable.Request<Id>): Promise<Adapter.Debugger.Enable.Response<Id>>
    disable<Id extends number = number>(request: Adapter.Debugger.Disable.Request<Id>): Promise<void>
    removeBreakpointsByUrl<Id extends number = number>(request: Adapter.Debugger.RemoveBreakpointsByUrl.Request<Id>): Promise<Adapter.Debugger.RemoveBreakpointsByUrl.Response<Id>>
    getPossibleAndSetBreakpointByUrl<Id extends number = number>(request: Adapter.Debugger.GetPossibleAndSetBreakpointByUrl.Request<Id>): Promise<Adapter.Debugger.GetPossibleAndSetBreakpointByUrl.Response<Id>>
  }

  export interface Runtime {
    enable<Id extends number = number>(request: Adapter.Runtime.Enable.Request<Id>): Promise<Adapter.Runtime.Enable.Response<Id>>
  }
}

export namespace Adapter.Runtime.Enable {
  export interface Request<Id extends number = number> extends Adapter.Request<Id, void> {}

  export type Option = 'enableLaunchAccelerate'

  export interface Result {
    options: (Option | (string & {}))[]
    maxScriptsCacheSize: number
  }

  export interface Response<Id extends number = number> extends Adapter.Response<Id, Result> {}
}

export namespace Adapter.Debugger.Enable {
  export interface Params {
    options: string[]
    maxScriptsCacheSize: number
  }

  export interface Request<Id extends number = number> extends Adapter.Request<Id, Params> {}

  export type Protocol = 'removeBreakpointsByUrl' | 'setMixedDebugEnabled' | 'replyNativeCalling' | 'getPossibleAndSetBreakpointByUrl' | 'dropFrame' | 'setNativeRange' | 'resetSingleStepper' | 'callFunctionOn' | 'smartStepInto' | 'saveAllPossibleBreakpoints' | 'setSymbolicBreakpoints' | 'removeSymbolicBreakpoints'

  export interface Result {
    debuggerId: string
    protocols: (Protocol | (string & {}))[]
  }

  export interface Response<Id extends number = number> extends Adapter.Response<Id, Result> {}
}

export namespace Adapter.Debugger.Disable {
  export interface Request<Id extends number = number> extends Adapter.Request<Id, void> {}
}

export namespace Adapter.Debugger.GetPossibleAndSetBreakpointByUrl {
  export interface Params {
    locations: Adapter.Location[]
  }

  export interface Request<Id extends number = number> extends Adapter.Request<Id, Params> {}

  export interface Result {
    breakpoints: Adapter.Location[]
  }

  export interface Response<Id extends number = number> extends Adapter.Response<Id, Result> {}
}

export namespace Adapter.Debugger.RemoveBreakpointsByUrl {
  export interface Params {
    url: string
  }

  export interface Request<Id extends number = number> extends Adapter.Request<Id, Params> {}

  export interface Response<Id extends number = number> extends Adapter.Response<Id, void> {}
}
