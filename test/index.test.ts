import type { Connection } from '../src'
import type { WsAdapter } from '../src/ws'
import WebSocket from 'ws'
import { Adapter, createConnection, JsonException } from '../src'
import { createWsAdapter } from '../src/ws'

describe('connection', (it) => {
  let connection: Connection<WsAdapter<'ws://localhost'>>
  let debuggerAdapter: Adapter.Debugger
  let runtimeAdapter: Adapter.Runtime

  it.sequential('should create a connection', async () => {
    connection = await createConnection({
      adapter: createWsAdapter('ws://localhost'),
      identifier: 'cc.naily.myapplication',
    })
    expect(connection.getPid()).toBeDefined()
    debuggerAdapter = await connection.getDebuggerAdapter()
    runtimeAdapter = await connection.getRuntimeAdapter()
    expect(debuggerAdapter).toBeDefined()
    expect(runtimeAdapter).toBeDefined()
    connection.getAdapter().getKeepAliveWebSocket()?.on('message', (message) => {
      console.log(`Received keep alive message:`)
      console.dir(message.toString(), { depth: null })
    })
    connection.push(
      connection.onNotification(async (notification) => {
        if (!JsonException.isJsonException(notification)) {
          console.log(`Received notification:`)
          return console.log(notification)
        }
        if (!notification.cause) {
          console.log(`Received error:`)
          return console.log(notification)
        }

        try {
          const data = typeof notification.cause === 'string' ? JSON.parse(notification.cause as string) : notification.cause
          if (!data || data.method !== 'Debugger.scriptParsed') {
            console.log(`Received unexpected error:`)
            return console.log(notification)
          }
          console.log(`Received script parsed:`)
          console.dir(data, { depth: null })

          const setBreakpointResponse = await debuggerAdapter.getPossibleAndSetBreakpointByUrl({
            params: {
              locations: [
                {
                  url: 'entry|entry|1.0.0|src/main/ets/entryability/EntryAbility.ts',
                  lineNumber: 0,
                  columnNumber: 0,
                },
              ],
            },
          })
          if (!Adapter.Response.is(setBreakpointResponse)) throw new Error(`Failed to set breakpoint: ${setBreakpointResponse}`)
          console.log(`Debugger.getPossibleAndSetBreakpointByUrl`)
          console.dir(setBreakpointResponse, { depth: null })

          const removeBreakpointsResponse = await debuggerAdapter.removeBreakpointsByUrl({ params: { url: 'entry|entry|1.0.0|src/main/ets/entryability/EntryAbility.ts' } })
          if (!Adapter.Response.is(removeBreakpointsResponse)) throw new Error(`Failed to remove breakpoints by url: ${removeBreakpointsResponse}`)
          console.dir(removeBreakpointsResponse, { depth: null })

          return console.log(data)
        }
        catch (error) {
          console.log(`Received unexpected JSON parse error:`)
          return console.log(error)
        }
      }),
    )
  })

  describe('runtime', (it) => {
    it.sequential('should enable runtime', async () => {
      const response = await runtimeAdapter.enable({ params: {} })
      if (!Adapter.Response.is(response)) throw new Error(`Failed to enable runtime: ${response}`)
      console.log(`Runtime.enable`)
      console.dir(response, { depth: null })
    })
  })

  describe('debugger', (it) => {
    it.sequential('should enable debugger', async () => {
      const response = await debuggerAdapter.enable({
        params: {
          maxScriptsCacheSize: 1.0e7,
          options: ['enableLaunchAccelerate'],
        },
      })
      if (!Adapter.Response.is(response)) throw new Error(`Failed to enable debugger: ${response}`)
      console.log(`Debugger.enable`)
      console.dir(response, { depth: null })
    })

    it.sequential('should save all possible breakpoints', async () => {
      const response = await debuggerAdapter.saveAllPossibleBreakpoints({ params: { locations: {} } })
      if (!Adapter.Response.is(response)) throw new Error(`Failed to save all possible breakpoints: ${response}`)
      console.log(`Debugger.saveAllPossibleBreakpoints`)
      console.dir(response, { depth: null })
    })

    it.sequential('should run if waiting for debugger', async () => {
      const response = await runtimeAdapter.runIfWaitingForDebugger({ params: {} })
      if (!Adapter.Response.is(response)) throw new Error(`Failed to run if waiting for debugger: ${response}`)
      console.log(`Runtime.runIfWaitingForDebugger`)
      console.dir(response, { depth: null })
    })
  })

  it.sequential('should dispose the connection', async () => {
    await connection.dispose()
    expect(connection.length).toBe(0)
    expect(connection.getAdapter().getControlWebSocket()?.readyState).toBe(WebSocket.CLOSED)
    expect(connection.getAdapter().getKeepAliveWebSocket()?.readyState).toBe(WebSocket.CLOSED)
  })
})
