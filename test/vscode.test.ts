import { execSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DebugClient } from '@vscode/debugadapter-testsupport'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'

const __dirname = dirname(fileURLToPath(import.meta.url))
const adapterPath = join(__dirname, '..', 'dist', 'bin.cjs')
const e2eIdentifier = process.env.VSCODE_E2E_IDENTIFIER ?? 'cc.naily.myapplication'
const e2eAbilityName = process.env.VSCODE_E2E_ABILITY ?? 'EntryAbility'
const e2eControlPort = process.env.VSCODE_E2E_CONTROL_PORT ? Number(process.env.VSCODE_E2E_CONTROL_PORT) : undefined
const e2eDevtoolsPort = process.env.VSCODE_E2E_DEVTOOLS_PORT ? Number(process.env.VSCODE_E2E_DEVTOOLS_PORT) : undefined

describe('vscode debug adapter', () => {
  let dc: DebugClient

  beforeAll(async () => {
    execSync('pnpm build', { stdio: 'inherit' })
  })

  afterEach(async () => {
    if (dc) await dc.stop()
  })

  it.sequential('should connect via createConnection (requires device & hdc)', async () => {
    dc = new DebugClient('node', adapterPath, 'node', undefined, true)
    dc.defaultTimeout = 20_000
    await dc.start()

    const initResp = await dc.initializeRequest()
    expect(initResp.body?.supportsConfigurationDoneRequest).toBe(true)
    await dc.configurationDoneRequest()

    // 触发 createConnection 走真实设备
    await dc.launch({
      identifier: e2eIdentifier as `${string}.${string}.${string}`,
      abilityName: e2eAbilityName,
      controlPort: e2eControlPort,
      devtoolsPort: e2eDevtoolsPort,
      program: 'main.js',
      stopOnEntry: true,
    })

    // 至少要停在入口
    await dc.assertStoppedLocation('entry', { line: 1 })

    // 断点回包 verified
    const bpResp = await dc.setBreakpointsRequest({
      source: { path: 'test.js' },
      breakpoints: [{ line: 3 }],
    })
    expect(bpResp.body?.breakpoints?.[0]?.verified).toBe(true)

    // 线程与栈帧
    const threads = await dc.threadsRequest()
    expect(threads.body?.threads?.length).toBeGreaterThan(0)
    const threadId = threads.body.threads[0].id
    const stack = await dc.stackTraceRequest({ threadId })
    expect(stack.body?.stackFrames?.[0]?.line).toBe(1)

    // scopes / variables（远端 getProperties）
    const frameId = stack.body.stackFrames[0].id
    const scopes = await dc.scopesRequest({ frameId })
    const firstScope = scopes.body?.scopes?.[0]
    expect(firstScope?.variablesReference).toBeDefined()
    const vars = await dc.variablesRequest({ variablesReference: firstScope!.variablesReference })
    expect(Array.isArray(vars.body?.variables)).toBe(true)
  }, 40_000)
})
