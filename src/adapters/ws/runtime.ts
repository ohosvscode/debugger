import type { WsAdapter } from '.'
import type { Adapter } from '../../adapter'

export class WsRuntimeAdapter implements Adapter.Runtime {
  constructor(private readonly adapter: WsAdapter) {}

  async enable<Id extends number = number>(request: Adapter.Runtime.Enable.Request<Id>): Promise<Adapter.Runtime.Enable.Response<Id>> {
    this.adapter.getWebSocket()?.send(JSON.stringify({
      id: request.id,
    }))
  }
}
