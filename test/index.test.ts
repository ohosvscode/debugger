import type { Adapter, Connection } from '../src'
import { createConnection } from '../src'
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
  })

  it.sequential('should set breakpoint', async () => {
    const response = await debuggerAdapter.enable({
      params: {
        maxScriptsCacheSize: 1.0e7,
        options: ['enableLaunchAccelerate'],
      },
    })
    console.warn(response)
  })
})
