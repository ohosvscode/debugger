import type { Connection } from '../src'
import type { WsAdapter } from '../src/ws'
import WebSocket from 'ws'
import { Adapter, createConnection } from '../src'
import { createWsAdapter } from '../src/ws'

describe('connection', (it) => {
  let connection: Connection<WsAdapter>
  let debuggerAdapter: Adapter.Debugger

  it.sequential('should create a connection', async () => {
    connection = await createConnection({
      adapter: createWsAdapter(),
      identifier: 'cc.naily.myapplication',
    })
    expect(connection.getPid()).toBeDefined()
    debuggerAdapter = await connection.getDebuggerAdapter()
    expect(debuggerAdapter).toBeDefined()
    connection.push(
      connection.onNotification((notification) => {
        console.warn(notification)
      }),
    )
  })

  it.sequential('should set breakpoint', async () => {
    const response = await debuggerAdapter.enable({
      params: {
        maxScriptsCacheSize: 1.0e7,
        options: ['enableLaunchAccelerate'],
      },
    })
    if (!Adapter.Response.is(response)) throw new Error(`Failed to set breakpoint: ${response}`)
    console.warn(response.result)
  })

  it.sequential('should dispose the connection', async () => {
    await connection.dispose()
    expect(connection.length).toBe(0)
    expect(connection.getAdapter().getControlWebSocket()?.readyState).toBe(WebSocket.CLOSED)
    expect(connection.getAdapter().getKeepAliveWebSocket()?.readyState).toBe(WebSocket.CLOSED)
  })
})
