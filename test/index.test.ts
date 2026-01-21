import type { Connection } from '../src'
import { Adapter, createConnection } from '../src'
import { createWsAdapter } from '../src/ws'

describe('connection', (it) => {
  let connection: Connection
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

  afterAll(async () => {
    await connection.dispose()
  })
})
