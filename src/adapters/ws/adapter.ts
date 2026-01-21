import type { Connection } from '../../connection'
import type { Awaitable } from '../../types'
import WebSocket from 'ws'
import { Adapter } from '../../adapter'
import { JsonException } from '../../errors/json-exception'
import { JSONPromiseify } from '../../utils'
import { WsDebuggerAdapter } from './debugger'
import { WsRuntimeAdapter } from './runtime'

export class WsAdapterImpl implements Adapter {
  private readonly _debuggerAdapter = new WsDebuggerAdapter(this)
  private readonly _runtimeAdapter = new WsRuntimeAdapter(this)

  constructor(
    private readonly options: WsAdapter.ResolvedOptions,
    private readonly connection: Connection,
    private readonly ws: WebSocket,
    private readonly keepAlive?: WebSocket,
  ) {
  }

  getResolvedOptions(): WsAdapter.ResolvedOptions {
    return this.options
  }

  getConnection(): Connection {
    return this.connection
  }

  async getDebuggerAdapter(): Promise<Adapter.Debugger> {
    return this._debuggerAdapter
  }

  async getRuntimeAdapter(): Promise<Adapter.Runtime> {
    return this._runtimeAdapter
  }

  getControlWebSocket(): WebSocket | undefined {
    return this.ws
  }

  getKeepAliveWebSocket(): WebSocket | undefined {
    return this.keepAlive
  }

  async sendNotification<Id extends number = number, Params = unknown>(notification: Adapter.OptionalNotification<Id, Params>): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws.send(
        JSON.stringify({
          id: notification.id ?? this.connection.generateIdentifier(),
          method: notification.method,
          params: notification.params,
        }),
        error => error ? reject(error) : resolve(),
      )
    })
  }

  async sendRequest<Id extends number = number, Params = unknown, Result = unknown, ErrorData = unknown>(request: Adapter.OptionalNotification<Id, Params>): Promise<Adapter.Response<Id, Result> | Adapter.Error<Id, ErrorData>> {
    const id = request.id ?? this.connection.generateIdentifier()
    await this.sendNotification({ id, method: request.method, params: request.params })

    return new Promise((resolve, reject) => {
      this.ws.on('message', async (message) => {
        try {
          const data = await JSONPromiseify.parse(message.toString())
          if (Adapter.Response.is(data)) resolve(data as Adapter.Response<Id, Result>)
          else if (Adapter.Error.is(data)) resolve(data as Adapter.Error<Id, ErrorData>)
          else reject(new JsonException(`Unknown JSON-RPC response: ${message.toString()}`, JsonException.Type.UNKNOWN_JSONRPC_RESPONSE))
        }
        catch (error) {
          reject(error)
        }
      })
    })
  }

  dispose(): Awaitable<void> {
    this.ws?.close()
    this.keepAlive?.close()
  }
}

export namespace WsAdapter {
  export interface Options {
    host?: string
    protocol?: 'ws' | 'wss' | (string & {})
  }

  export interface ResolvedOptions extends Required<Options> {}
}

export async function createWsAdapter(options: WsAdapter.Options = {}): Promise<Adapter.Factory> {
  const resolvedOptions = resolveOptions(options)
  return {
    onInitialize(connection) {
      // 9229: DevTools UI/保活通道；先连上并发送握手，保持后端不断线
      const keepAlive = new WebSocket(`${resolvedOptions.protocol}://${resolvedOptions.host}:${connection.getDevtoolsPort()}`)
      keepAlive.on('open', () => keepAlive.send(JSON.stringify({ type: 'connected' })))

      // 9230: 控制/调试通道（Chrome 亦连接此端口）
      const ws = new WebSocket(`${resolvedOptions.protocol}://${resolvedOptions.host}:${connection.getControlPort()}`)

      return new Promise((resolve, reject) => {
        function handleOpen() {
          ws.off('open', handleOpen)
          ws.off('error', handleError)
          resolve(new WsAdapterImpl(resolvedOptions, connection, ws, keepAlive))
        }

        function handleError(error: Error) {
          ws.off('open', handleOpen)
          ws.off('error', handleError)
          keepAlive.close()
          reject(error)
        }

        ws.on('open', handleOpen)
        ws.on('error', handleError)
      })
    },
  }
}

function resolveOptions(options: WsAdapter.Options): WsAdapter.ResolvedOptions {
  return {
    host: options.host ?? 'localhost',
    protocol: options.protocol ?? 'ws',
  }
}
