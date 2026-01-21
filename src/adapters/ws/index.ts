import type { Adapter } from '../../adapter'
import type { Connection } from '../../connection'
import type { Awaitable } from '../../types'
import WebSocket from 'ws'
import { WsDebuggerAdapter } from './debugger'
import { WsRuntimeAdapter } from './runtime'

export class WsAdapter implements Adapter {
  private _ws: WebSocket
  private readonly _debuggerAdapter = new WsDebuggerAdapter(this)
  private readonly _runtimeAdapter = new WsRuntimeAdapter(this)

  constructor(private readonly options: WsAdapter.ResolvedOptions) {}

  onInitialize(options: Connection.ResolvedOptions): Awaitable<void> {
    if (!this._ws) this._ws = new WebSocket(`${this.options.protocol}://${this.options.host}:${options.devtoolsPort}`)
  }

  getDebuggerAdapter(): Adapter.Debugger {
    return this._debuggerAdapter
  }

  getRuntimeAdapter(): Adapter.Runtime {
    return this._runtimeAdapter
  }

  getWebSocket(): WebSocket | undefined {
    return this._ws
  }

  dispose(): Awaitable<void> {
    this._ws?.close()
  }
}

export namespace WsAdapter {
  export interface Options {
    host?: string
    protocol?: 'ws' | 'wss' | (string & {})
  }

  export interface ResolvedOptions extends Required<Options> {}
}

export async function createWsAdapter(options: WsAdapter.Options = {}): Promise<WsAdapter> {
  const resolvedOptions = resolveOptions(options)
  return new WsAdapter(resolvedOptions)
}

function resolveOptions(options: WsAdapter.Options): WsAdapter.ResolvedOptions {
  return {
    host: options.host ?? 'localhost',
    protocol: options.protocol ?? 'ws',
  }
}
