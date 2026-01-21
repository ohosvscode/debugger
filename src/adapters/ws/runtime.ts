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

  runIfWaitingForDebugger<Id extends number = number>(request: Adapter.Runtime.RunIfWaitingForDebugger.Request<Id>): Promise<Adapter.Runtime.RunIfWaitingForDebugger.Response<Id> | Adapter.Error<Id>> {
    return this.adapter.sendRequest({
      ...request,
      method: 'Runtime.runIfWaitingForDebugger',
    })
  }
}
