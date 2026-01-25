import type { DebugProtocol } from '@vscode/debugprotocol'
import type { VscodeDebuggerAdapter } from './debugger-adapter'
import fs from 'node:fs'
import path from 'node:path'
import JSON5 from 'json5'
import { Adapter, createConnection as createCoreConnection } from '../index'
import { createWsAdapter } from '../ws'

export async function createCDPConnection(resolvedArgs: Arguments.ResolvedArguments, identifier: `${string}.${string}.${string}`, vscodeDebuggerAdapter: VscodeDebuggerAdapter) {
  vscodeDebuggerAdapter.getLogger().getConsola().info('ArkTS debugger is starting...')

  const connection = await createCoreConnection({
    adapter: createWsAdapter(),
    abilityName: resolvedArgs.abilityName,
    controlPort: resolvedArgs.controlPort,
    devtoolsPort: resolvedArgs.devtoolsPort,
    identifier,
  })
  vscodeDebuggerAdapter.getLogger().getConsola().info(`Connected.`)

  async function enable() {
    await enableRuntimeNamespace(vscodeDebuggerAdapter)
    await enableDebuggerNamespace(vscodeDebuggerAdapter)
  }

  async function setInitialBreakpoints() {
    const debuggerAdapter = await connection.getDebuggerAdapter()
    const locations: Adapter.MultiLocation = {}

    for (const [filePath, breakpoint] of vscodeDebuggerAdapter.getBreakpointStore().entries()) {
      if (!locations[filePath]) {
        locations[filePath] = [
          {
            lineNumber: breakpoint.line,
            columnNumber: breakpoint.column ?? 0,
          },
        ]
      }
      else {
        locations[filePath].push({
          lineNumber: breakpoint.line,
          columnNumber: breakpoint.column ?? 0,
        })
      }
    }

    const result = await debuggerAdapter.saveAllPossibleBreakpoints({
      params: { locations },
    })
    if (!Adapter.Response.is(result)) return vscodeDebuggerAdapter.getLogger().data('Failed to set initial breakpoints:', result)
    vscodeDebuggerAdapter.getLogger().data('Initial breakpoints set.', result)
  }

  async function runIfWaitingForDebugger() {
    const runtimeAdapter = await connection.getRuntimeAdapter()
    const result = await runtimeAdapter.runIfWaitingForDebugger({
      params: {},
    })
    if (!Adapter.Response.is(result)) return vscodeDebuggerAdapter.getLogger().data('Failed to run if waiting for debugger:', result)
    vscodeDebuggerAdapter.getLogger().data('Run if waiting for debugger.', result)
  }

  return {
    connection,
    enable,
    setInitialBreakpoints,
    runIfWaitingForDebugger,
  }
}

async function enableDebuggerNamespace(vscodeDebuggerAdapter: VscodeDebuggerAdapter) {
  const debuggerAdapter = await vscodeDebuggerAdapter.getConnection()?.getDebuggerAdapter()
  if (!debuggerAdapter) return vscodeDebuggerAdapter.getLogger().getConsola().info('The debugger adapter is not found.')
  const result = await debuggerAdapter.enable({
    params: {
      options: ['enableLaunchAccelerate'],
      maxScriptsCacheSize: 1.0e7,
    },
  })
  if (!Adapter.Response.is(result)) return vscodeDebuggerAdapter.getLogger().data('Failed to enable debugger namespace:', result)
  vscodeDebuggerAdapter.getLogger().data('Debugger namespace enabled.', result)
  return debuggerAdapter
}

async function enableRuntimeNamespace(vscodeDebuggerAdapter: VscodeDebuggerAdapter) {
  const runtimeAdapter = await vscodeDebuggerAdapter.getConnection()?.getRuntimeAdapter()
  if (!runtimeAdapter) return vscodeDebuggerAdapter.getLogger().getConsola().info('The runtime adapter is not found.')
  const result = await runtimeAdapter.enable({ params: {} })
  if (!Adapter.Response.is(result)) return vscodeDebuggerAdapter.getLogger().data('Failed to enable runtime namespace:', result)
  vscodeDebuggerAdapter.getLogger().data('Runtime namespace enabled.', result)
  return runtimeAdapter
}

export interface Arguments extends DebugProtocol.LaunchRequestArguments, Arguments.BaseArguments {}

export namespace Arguments {
  export interface BaseArguments {
    /** The ability name of the application. @default EntryAbility */
    abilityName?: 'EntryAbility' | (string & {})
    /** The control port of the application. @default 9230 */
    controlPort?: number
    /** The devtools port of the application. @default 9229 */
    devtoolsPort?: number
    /** Hvigor project root. @default ${workspaceFolder} */
    projectRoot: string
  }

  export type ResolvedArguments = Required<BaseArguments> & DebugProtocol.LaunchRequestArguments

  export function resolve(args: Arguments): ResolvedArguments {
    return {
      ...args,
      abilityName: args.abilityName ?? 'EntryAbility',
      controlPort: args.controlPort ?? 9230,
      devtoolsPort: args.devtoolsPort ?? 9229,
    }
  }

  export function readIdentifierByProjectRoot(projectRoot: string): `${string}.${string}.${string}` | Error {
    const appScopeFolderPath = path.resolve(projectRoot, 'AppScope')
    if (!fs.existsSync(appScopeFolderPath)) return new Error('The AppScope folder does not exist in the project root.')
    if (!fs.statSync(appScopeFolderPath).isDirectory()) return new Error('The AppScope folder in the project root is not a directory.')

    const appJson5Path = path.resolve(appScopeFolderPath, 'app.json5')
    if (!fs.existsSync(appJson5Path)) return new Error('The AppScope/app.json5 file in the project root does not exist.')
    if (!fs.statSync(appJson5Path).isFile()) return new Error('The AppScope/app.json5 file in the project root is not a file.')

    const appJson5Content = fs.readFileSync(appJson5Path, 'utf-8')
    const appJson5 = JSON5.parse(appJson5Content)
    if (!appJson5?.app?.bundleName) return new Error('The AppScope/app.json5 file in the project root does not contain the `app.bundleName`.')
    if (typeof appJson5.app.bundleName !== 'string') return new Error('The `app.bundleName` in the AppScope/app.json5 file in the project root is not a string.')

    return appJson5.app.bundleName as `${string}.${string}.${string}`
  }
}
