import type { Adapter } from '../../adapter'
import type { WsAdapterImpl } from './adapter'

export class WsRuntimeAdapter implements Adapter.Runtime {
  constructor(private readonly adapter: WsAdapterImpl) {}

  enable<Id extends number = number>(request: Adapter.Runtime.Enable.Request<Id>): Promise<Adapter.Runtime.Enable.Response<Id> | Adapter.Error<Id>> {
    return this.adapter.sendRequest({
      ...request,
      method: 'Runtime.enable',
    })
  }

  disable<Id extends number = number>(request: Adapter.Runtime.Disable.Request<Id>): Promise<Adapter.Runtime.Disable.Response<Id> | Adapter.Error<Id>> {
    return this.adapter.sendRequest({
      ...request,
      method: 'Runtime.disable',
    })
  }

  runIfWaitingForDebugger<Id extends number = number>(request: Adapter.Runtime.RunIfWaitingForDebugger.Request<Id>): Promise<Adapter.Runtime.RunIfWaitingForDebugger.Response<Id> | Adapter.Error<Id>> {
    return this.adapter.sendRequest({
      ...request,
      method: 'Runtime.runIfWaitingForDebugger',
    })
  }

  getProperties<Id extends number = number>(request: Adapter.Runtime.GetProperties.Request<Id>): Promise<Adapter.Runtime.GetProperties.Response<Id> | Adapter.Error<Id>> {
    return this.adapter.sendRequest({
      ...request,
      method: 'Runtime.getProperties',
    })
  }
}
