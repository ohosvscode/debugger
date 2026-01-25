import type { ClientRequestArgs } from 'node:http'
import type { Adapter } from '../../adapter'
import type { Connection } from '../../connection'
import type { JsonException } from '../../errors/json-exception'
import WebSocket from 'ws'
import { BaseAdapter } from '../../base-adapter'
import { Disposable } from '../../types'
import { JSONPromiseify } from '../../utils'
import { WsDebuggerAdapter } from './debugger'
import { WsRuntimeAdapter } from './runtime'

export class WsAdapterImpl extends BaseAdapter implements WsAdapter {
  private readonly _debuggerAdapter = new WsDebuggerAdapter(this)
  private readonly _runtimeAdapter = new WsRuntimeAdapter(this)

  constructor(
    protected readonly connection: Connection,
    private readonly options: WsAdapter.ResolvedOptions,
    private readonly ws: WebSocket,
    private readonly keepAlive: WebSocket,
  ) { super(connection) }

  getResolvedOptions(): WsAdapter.ResolvedOptions {
    return this.options
  }

  async getDebuggerAdapter(): Promise<Adapter.Debugger> {
    return this._debuggerAdapter
  }

  async getRuntimeAdapter(): Promise<Adapter.Runtime> {
    return this._runtimeAdapter
  }

  getControlWebSocket(): WebSocket {
    return this.ws
  }

  getKeepAliveWebSocket(): WebSocket {
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

  onNotification<Id extends number = number, Params = unknown>(callback: (notification: Adapter.OptionalNotification<Id, Params> | JsonException) => void): Disposable {
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
}

export namespace WsAdapter {
  export interface Options extends Partial<Omit<URL, 'toJSON' | 'port'>> {
    devtoolsWebSocketOptions?: WebSocket.ClientOptions | ClientRequestArgs
    controlWebSocketOptions?: WebSocket.ClientOptions | ClientRequestArgs
    devtoolsWebSocketProtocols?: string[]
    controlWebSocketProtocols?: string[]
  }
  export interface ResolvedOptions extends Options {
    devtoolsWebSocketOptions?: WebSocket.ClientOptions | ClientRequestArgs
    controlWebSocketOptions?: WebSocket.ClientOptions | ClientRequestArgs
    devtoolsWebSocketProtocols?: string[]
    controlWebSocketProtocols?: string[]
  }
  export interface TypedWebSocket<TWebSocketUrlNotPortString extends string = string> extends Omit<WebSocket, 'url'> {
    readonly url: TWebSocketUrlNotPortString
  }
}

export interface WsAdapter<in out TWebSocketUrlNotPortString extends string = string> extends Adapter {
  /**
   * Get the resolved options.
   */
  getResolvedOptions(): WsAdapter.ResolvedOptions
  /**
   * Get control web socket.
   */
  getControlWebSocket(): WsAdapter.TypedWebSocket<TWebSocketUrlNotPortString>
  /**
   * Get keep alive web socket.
   */
  getKeepAliveWebSocket(): WsAdapter.TypedWebSocket<TWebSocketUrlNotPortString>
}

/**
 * Create a WebSocket adapter using `ws`.
 *
 * @param options - The options to create the adapter. Except for the `port`, all other options are extended from the {@linkcode URL} instance.
 * If you provide the `port` it will be ignored. Please use the `createConnection` function to provide the `Devtools Port` and `Control Port`.
 */
export async function createWsAdapter(options?: WsAdapter.Options): Promise<Adapter.Factory<WsAdapter>>
/**
 * Create a WebSocket adapter using `ws`.
 *
 * @param websocketUrlNotPortString - The WebSocket URL string without the `port`. If you still provide the port, it will be ignored.
 * Please use the `createConnection` function to provide the `Devtools Port` and `Control Port`.
 */
export async function createWsAdapter<TWebSocketUrlNotPortString extends string = string>(websocketUrlNotPortString?: TWebSocketUrlNotPortString): Promise<Adapter.Factory<WsAdapter<TWebSocketUrlNotPortString>>>
export async function createWsAdapter(options: WsAdapter.Options | string = new URL('ws://localhost')): Promise<Adapter.Factory<WsAdapter>> {
  const resolvedOptions = resolveOptions(options)

  return {
    onInitialize(connection) {
      // 9229: DevTools UI/保活通道；先连上并发送握手，保持后端不断线
      const keepAlive = new WebSocket(
        resolveUrl(resolvedOptions, connection.getDevtoolsPort()).toString(),
        (resolvedOptions.devtoolsWebSocketProtocols
          ? resolvedOptions.devtoolsWebSocketProtocols
          : resolvedOptions.devtoolsWebSocketOptions) as string[], // as string[] to ignore the type error
        Array.isArray(resolvedOptions.devtoolsWebSocketProtocols)
          ? resolvedOptions.devtoolsWebSocketOptions
          : undefined,
      )
      keepAlive.on('open', () => keepAlive.send(JSON.stringify({ type: 'connected' })))

      // 9230: 控制/调试通道（Chrome 亦连接此端口）
      const ws = new WebSocket(
        resolveUrl(resolvedOptions, connection.getControlPort()),
        (resolvedOptions.controlWebSocketProtocols
          ? resolvedOptions.controlWebSocketProtocols
          : resolvedOptions.controlWebSocketOptions) as string[], // as string[] to ignore the type error
        Array.isArray(resolvedOptions.controlWebSocketProtocols)
          ? resolvedOptions.controlWebSocketOptions
          : undefined,
      )

      return new Promise((resolve, reject) => {
        function handleOpen() {
          ws.off('open', handleOpen)
          ws.off('error', handleError)
          resolve(new WsAdapterImpl(connection, resolvedOptions, ws, keepAlive))
        }

        function handleError(error: Error) {
          ws.off('open', handleOpen)
          ws.off('error', handleError)
          keepAlive.close()
          reject(error)
        }

        ws.on('open', handleOpen)
        ws.on('error', handleError)

        connection.push(
          Disposable.from(() => {
            console.log('dispose', ws)
            ws.close()
            console.log('keepAlive close', keepAlive)
            keepAlive.close()
          }),
        )
      })
    },
  }
}

function resolveOptions(options: WsAdapter.Options | string): WsAdapter.ResolvedOptions {
  if (typeof options === 'string') return new URL(options)

  return {
    hash: options.hash,
    host: options.host ?? 'localhost',
    hostname: options.hostname,
    href: options.href,
    origin: options.origin,
    password: options.password,
    pathname: options.pathname,
    protocol: options.protocol,
    search: options.search,
    searchParams: options.searchParams,
    username: options.username,
  }
}

function resolveUrl(resolvedOptions: WsAdapter.ResolvedOptions, port: number): URL {
  const url = new URL('ws://127.0.0.1')
  if (resolvedOptions.hash) url.hash = resolvedOptions.hash
  if (resolvedOptions.host) url.host = resolvedOptions.host
  if (resolvedOptions.hostname) url.hostname = resolvedOptions.hostname
  if (resolvedOptions.href) url.href = resolvedOptions.href
  if (resolvedOptions.password) url.password = resolvedOptions.password
  if (resolvedOptions.pathname) url.pathname = resolvedOptions.pathname
  url.port = port.toString()
  if (resolvedOptions.protocol) url.protocol = resolvedOptions.protocol
  if (resolvedOptions.search) url.search = resolvedOptions.search
  if (resolvedOptions.searchParams) {
    for (const [key, value] of resolvedOptions.searchParams.entries()) {
      url.searchParams.set(key, value)
    }
  }
  if (resolvedOptions.username) url.username = resolvedOptions.username
  return url
}
