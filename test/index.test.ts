import type { Connection } from '../src'
import type { WsAdapter } from '../src/ws'
import { Adapter, createConnection } from '../src'
import { sleep } from '../src/utils'
import { createWsAdapter } from '../src/ws'

describe('connection', (it) => {
  let connection: Connection<WsAdapter>
  let debuggerAdapter: Adapter.Debugger
  let runtimeAdapter: Adapter.Runtime

  it.sequential('should create a connection', async () => {
    connection = await createConnection({
      adapter: createWsAdapter(),
      identifier: 'cc.naily.myapplication',
      abilityName: 'EntryAbility',
    })
    expect(connection.getPid()).toBeDefined()
    debuggerAdapter = await connection.getDebuggerAdapter()
    runtimeAdapter = await connection.getRuntimeAdapter()
    expect(debuggerAdapter).toBeDefined()
    expect(runtimeAdapter).toBeDefined()

    return new Promise<void>((resolve) => {
      connection.getAdapter().getKeepAliveWebSocket().on('message', async (message) => {
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
        connection.push(
          debuggerAdapter.onScriptParsed({
            onScriptParsed(notification) {
              console.log(`Debugger.scriptParsed: ${notification.params.url}`)
            },
            async onExceeded(notifications) {
              await sleep(3000)
              for (const notification of notifications) {
                const setBreakpointsResponse = await debuggerAdapter.getPossibleAndSetBreakpointByUrl({
                  params: {
                    locations: [
                      { url: notification.params.url, columnNumber: 0, lineNumber: 0 },
                    ],
                  },
                })
                console.log(`Debugger.getPossibleAndSetBreakpointByUrl`)
                console.dir(setBreakpointsResponse, { depth: null })
              }

              await sleep(1000)

              for (const notification of notifications) {
                const removeBreakpointsResponse = await debuggerAdapter.removeBreakpointsByUrl({
                  params: {
                    url: notification.params.url,
                  },
                })
                console.log(`Debugger.removeBreakpointsByUrl`)
                console.dir(removeBreakpointsResponse, { depth: null })
              }
              resolve()
            },
          }, 2),
        )
      })
    }).then(async () => {
      const runtimeDisableResponse = await runtimeAdapter.disable({ params: {} })
      console.log(`Runtime.disable`)
      console.dir(runtimeDisableResponse, { depth: null })

      const debuggerDisableResponse = await debuggerAdapter.disable({ params: {} })
      console.log(`Debugger.disable`)
      console.dir(debuggerDisableResponse, { depth: null })
    })
  }, 10000)
})
