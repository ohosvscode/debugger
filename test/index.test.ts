import type { Connection } from '../src'
import type { WsAdapter } from '../src/ws'
import { Adapter, createConnection } from '../src'
import { sleep } from '../src/utils'
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

    return new Promise<void>((resolve) => {
      connection.getAdapter().getKeepAliveWebSocket()?.on('message', async (message) => {
        console.log(`Received keep alive message:`)
        const data = JSON.parse(message.toString())
        console.dir(data, { depth: null })
        if (data.type !== 'addInstance') return
        resolve()
      })
    }).then(async () => {
      const runtimeEnableResponse = await runtimeAdapter.enable({ params: { options: ['enableLaunchAccelerate'], maxScriptsCacheSize: 1.0e7 } })
      if (!Adapter.Response.is(runtimeEnableResponse)) throw new Error(`Failed to enable runtime: ${runtimeEnableResponse}`)
      console.log(`Runtime.enable`)
      console.dir(runtimeEnableResponse, { depth: null })

      const debuggerEnableResponse = await debuggerAdapter.enable({ params: { maxScriptsCacheSize: 1.0e7, options: ['enableLaunchAccelerate'] } })
      if (!Adapter.Response.is(debuggerEnableResponse)) throw new Error(`Failed to enable debugger: ${debuggerEnableResponse}`)
      console.log(`Debugger.enable`)
      console.dir(debuggerEnableResponse, { depth: null })

      const saveAllPossibleBreakpointsResponse = await debuggerAdapter.saveAllPossibleBreakpoints({
        params: { locations: {} },
      })
      console.log(`Debugger.saveAllPossibleBreakpoints`)
      console.dir(saveAllPossibleBreakpointsResponse, { depth: null })

      const runIfWaitingForDebuggerResponse = await runtimeAdapter.runIfWaitingForDebugger({
        params: {},
      })
      console.log(`Runtime.runIfWaitingForDebugger`)
      console.dir(runIfWaitingForDebuggerResponse, { depth: null })

      return new Promise<void>((resolve) => {
        let count = 0
        connection.push(
          connection.onNotification(async (notification) => {
            if (!Adapter.OptionalNotification.is(notification)) return
            if (notification.method !== 'Debugger.scriptParsed') return
            count++
            console.log(`Debugger.scriptParsed: ${count}`)
            console.dir(notification, { depth: null })
            if (count < 2) return
            resolve()
          }),
        )
      })
    }).then(async () => {
      const setBreakpointsResponse = await debuggerAdapter.getPossibleAndSetBreakpointByUrl({
        params: {
          locations: [
            { url: 'entry|entry|1.0.0|src/main/ets/pages/Index.ts', columnNumber: 0, lineNumber: 0 },
          ],
        },
      })
      console.log(`Debugger.getPossibleAndSetBreakpointByUrl`)
      console.dir(setBreakpointsResponse, { depth: null })

      await sleep(3000)
    }).then(async () => {
      const runtimeDisableResponse = await runtimeAdapter.disable({ params: {} })
      console.log(`Runtime.disable`)
      console.dir(runtimeDisableResponse, { depth: null })

      const debuggerDisableResponse = await debuggerAdapter.disable({ params: {} })
      console.log(`Debugger.disable`)
      console.dir(debuggerDisableResponse, { depth: null })
    })
  })
})
