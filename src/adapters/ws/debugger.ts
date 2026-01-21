import type { WsAdapter } from '.'
import type { Adapter } from '../../adapter'

export class WsDebuggerAdapter implements Adapter.Debugger {
  constructor(private readonly adapter: WsAdapter) {}

  async enable<Id extends number = number>(request: Adapter.Debugger.Enable.Request<Id>): Promise<Adapter.Debugger.Enable.Response<Id>> {

  }

  async disable<Id extends number = number>(request: Adapter.Debugger.Disable.Request<Id>): Promise<void> {

  }

  async removeBreakpointsByUrl<Id extends number = number>(request: Adapter.Debugger.RemoveBreakpointsByUrl.Request<Id>): Promise<Adapter.Debugger.RemoveBreakpointsByUrl.Response<Id>> {

  }

  async getPossibleAndSetBreakpointByUrl<Id extends number = number>(request: Adapter.Debugger.GetPossibleAndSetBreakpointByUrl.Request<Id>): Promise<Adapter.Debugger.GetPossibleAndSetBreakpointByUrl.Response<Id>> {

  }
}
