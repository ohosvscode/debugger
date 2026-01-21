import type { Adapter } from '../../adapter'
import type { Connection } from '../../connection'
import type { JsonException } from '../../errors/json-exception'
import type { Awaitable } from '../../types'
import WebSocket from 'ws'
import { BaseAdapter } from '../../base-adapter'
import { Disposable } from '../../types'
import { JSONPromiseify } from '../../utils'
import { WsDebuggerAdapter } from './debugger'
import { WsRuntimeAdapter } from './runtime'

export class WsAdapterImpl extends BaseAdapter implements Adapter {
  private readonly _debuggerAdapter = new WsDebuggerAdapter(this)
  private readonly _runtimeAdapter = new WsRuntimeAdapter(this)

  constructor(
    private readonly options: WsAdapter.ResolvedOptions,
    private readonly connection: Connection,
    private readonly ws: WebSocket,
    private readonly keepAlive?: WebSocket,
  ) {
    super()
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

  onRequest<Id extends number = number, Result = unknown, ErrorData = unknown>(callback: (response: Adapter.Response<Id, Result> | Adapter.Error<Id, ErrorData> | JsonException) => void): Disposable {
    const onRequest = async (message: WebSocket.RawData) => {
      const response = await this.handleOnRequest<Id, Result, ErrorData>(typeof message === 'string' ? message : message.toString())
      if (response) callback(response)
    }

    this.ws.on('message', onRequest)

    return Disposable.from(() => {
      this.ws.off('message', onRequest)
    })
  }

  onNotification<Id extends number = number, Params = unknown>(callback: (notification: Adapter.Notification<Id, Params> | JsonException) => void): Disposable {
    const onNotification = async (message: WebSocket.RawData) => {
      const notification = await this.handleOnNotification<Id, Params>(typeof message === 'string' ? message : message.toString())
      if (notification) callback(notification)
    }

    this.ws.on('message', onNotification)

    return Disposable.from(() => {
      this.ws.off('message', onNotification)
    })
  }

  async sendNotification<Id extends number = number, Params = unknown>(notification: Adapter.OptionalNotification<Id, Params>): Promise<void> {
    return JSONPromiseify.stringify({
      id: notification.id ?? this.connection.generateIdentifier(),
      method: notification.method,
      params: notification.params,
    }).then(
      json => new Promise((resolve, reject) => {
        this.ws.send(json, error => error ? reject(error) : resolve())
      }),
    )
  }

  async sendRequest<Id extends number = number, Params = unknown, Result = unknown, ErrorData = unknown>(request: Adapter.OptionalNotification<Id, Params>): Promise<Adapter.Response<Id, Result> | Adapter.Error<Id, ErrorData>> {
    const id = request.id ?? this.connection.generateIdentifier()
    await this.sendNotification({ id, method: request.method, params: request.params })

    return new Promise((resolve) => {
      const onMessage = async (message: WebSocket.RawData) => {
        const response = await this.handleSendRequest<Id, Result, ErrorData>(typeof message === 'string' ? message : message.toString())
        if (response) resolve(response)
        this.ws.off('message', onMessage)
      }
      this.ws.on('message', onMessage)
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
