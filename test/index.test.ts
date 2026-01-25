import type { Connection } from '../src'
import type { WsAdapter } from '../src/ws'
import { Adapter, createConnection } from '../src'
import { sleep } from '../src/utils'
import { createWsAdapter } from '../src/ws'

describe('connection', (it) => {
  let connection: Connection<WsAdapter>
  let debuggerAdapter: Adapter.Debugger
  let runtimeAdapter: Adapter.Runtime
  let lastObjectId: string | undefined
  let pausedPromise: Promise<void> | undefined

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
      let pausedPromiseResolver: (() => void) | undefined
      const runtimeEnableResponse = await runtimeAdapter.enable({ params: { options: ['enableLaunchAccelerate'], maxScriptsCacheSize: 1.0e7 } })
      if (!Adapter.Response.is(runtimeEnableResponse)) throw new Error(`Failed to enable runtime: ${runtimeEnableResponse}`)
      console.log(`Runtime.enable`)
      console.dir(runtimeEnableResponse, { depth: null })

      const debuggerEnableResponse = await debuggerAdapter.enable({ params: { maxScriptsCacheSize: 1.0e7, options: ['enableLaunchAccelerate'] } })
      if (!Adapter.Response.is(debuggerEnableResponse)) throw new Error(`Failed to enable debugger: ${debuggerEnableResponse}`)
      console.log(`Debugger.enable`)
      console.dir(debuggerEnableResponse, { depth: null })

      const saveAllPossibleBreakpointsResponse = await debuggerAdapter.saveAllPossibleBreakpoints({
        params: {
          locations: {
            'entry|entry|1.0.0|src/main/ets/pages/Index.ts': [
              { lineNumber: 39, columnNumber: 8 },
            ],
          },
        },
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
          debuggerAdapter.onScriptParsed((notification) => {
            console.log(`Debugger.scriptParsed: ${notification.params.url}`)
            if ((notification.params as any).locations?.length) {
              console.log('scriptParsed.locations', (notification.params as any).locations)
            }
            resolve()
          }),
          // 监听 paused，捕获 objectId 以便后续 getProperties
          debuggerAdapter.onPaused((paused) => {
            const scopes = (
              paused.params as {
                callFrames?: Array<{ scopeChain?: Array<{ object?: { objectId?: string } }> }>
              } | undefined
            )?.callFrames?.[0]?.scopeChain ?? []
            const found = scopes.find(scope => scope?.object?.objectId)
            if (found?.object?.objectId) lastObjectId = found.object.objectId
            if (pausedPromiseResolver) {
              pausedPromiseResolver()
              pausedPromiseResolver = undefined
            }
          }),
        )
        pausedPromise = new Promise<void>((res) => { pausedPromiseResolver = res })
      })
    }).then(async () => {
      // 等待命中断点产生 paused（onPageShow 为生命周期自动触发，给足时间）
      if (pausedPromise) {
        await Promise.race([pausedPromise, sleep(30_000)])
      }
      if (!lastObjectId) throw new Error('等待 30s 仍未收到 Debugger.paused，可能生命周期未触发或行号不匹配')

      const runtimeDisableResponse = await runtimeAdapter.disable({ params: {} })
      console.log(`Runtime.disable`)
      console.dir(runtimeDisableResponse, { depth: null })

      const debuggerDisableResponse = await debuggerAdapter.disable({ params: {} })
      console.log(`Debugger.disable`)
      console.dir(debuggerDisableResponse, { depth: null })

      // 进一步验证 Runtime.getProperties
      if (!lastObjectId) {
        console.log('未捕获到 paused scope 的 objectId，跳过 getProperties 校验')
        return
      }
      const propsResp = await runtimeAdapter.getProperties({
        params: { objectId: lastObjectId, ownProperties: true, accessorPropertiesOnly: false, generatePreview: true },
      })
      console.log('Runtime.getProperties')
      console.dir(propsResp, { depth: null })
      expect(Adapter.Response.is(propsResp) || Adapter.Error.is(propsResp)).toBe(true)

      // 清理断点（使用已知脚本 URL）
      await debuggerAdapter.removeBreakpointsByUrl({ params: { url: 'entry|entry|1.0.0|src/main/ets/pages/Index.ts' } })
      await debuggerAdapter.removeBreakpointsByUrl({ params: { url: 'entry|entry|1.0.0|src/main/ets/entryability/EntryAbility.ts' } })
    })
  }, 20000)
})
