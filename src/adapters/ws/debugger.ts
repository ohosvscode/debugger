import type { Adapter } from '../../adapter'
import type { Awaitable } from '../../types'
import type { WsAdapterImpl } from './adapter'

export class WsDebuggerAdapter implements Adapter.Debugger {
  constructor(private readonly adapter: WsAdapterImpl) {}

  enable<Id extends number = number>(request: Adapter.Debugger.Enable.Request<Id>): Promise<Adapter.Debugger.Enable.Response<Id> | Adapter.Error<Id, unknown>> {
    return this.adapter.sendRequest({
      ...request,
      method: 'Debugger.enable',
    })
  }

  disable<Id extends number = number>(request: Adapter.Debugger.Disable.Request<Id>): Promise<Adapter.Debugger.Disable.Response<Id> | Adapter.Error<Id, unknown>> {
    return this.adapter.sendRequest({
      ...request,
      method: 'Debugger.disable',
    })
  }

  removeBreakpointsByUrl<Id extends number = number>(request: Adapter.Debugger.RemoveBreakpointsByUrl.Request<Id>): Promise<Adapter.Debugger.RemoveBreakpointsByUrl.Response<Id> | Adapter.Error<Id, unknown>> {
    return this.adapter.sendRequest({
      ...request,
      method: 'Debugger.removeBreakpointsByUrl',
    })
  }

  getPossibleAndSetBreakpointByUrl<Id extends number = number>(request: Adapter.Debugger.GetPossibleAndSetBreakpointByUrl.Request<Id>): Promise<Adapter.Debugger.GetPossibleAndSetBreakpointByUrl.Response<Id> | Adapter.Error<Id, unknown>> {
    return this.adapter.sendRequest({
      ...request,
      method: 'Debugger.getPossibleAndSetBreakpointByUrl',
    })
  }

  saveAllPossibleBreakpoints<Id extends number = number>(request: Adapter.Debugger.SaveAllPossibleBreakpoints.Request<Id>): Promise<Adapter.Debugger.SaveAllPossibleBreakpoints.Response<Id> | Adapter.Error<Id, unknown>> {
    return this.adapter.sendRequest({
      ...request,
      method: 'Debugger.saveAllPossibleBreakpoints',
    })
  }

  dispose(): Awaitable<void> {
    this.disable({
      id: this.adapter.getConnection().generateIdentifier(),
      params: {},
    })
  }
}
