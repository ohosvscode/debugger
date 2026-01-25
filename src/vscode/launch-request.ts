import type { DebugProtocol } from '@vscode/debugprotocol'
import type { Connection } from '../index'
import type { VscodeDebuggerAdapter } from './debugger-adapter'
import fs from 'node:fs'
import path from 'node:path'
import { SourceMapConsumer } from '@jridgewell/source-map'
import JSON5 from 'json5'
import { Adapter, createConnection } from '../index'
import { createWsAdapter } from '../ws'

export interface CDPConnection {
  getConnection(): Connection
  enable(): Promise<void>
  setInitialBreakpoints(): Promise<void>
  runIfWaitingForDebugger(): Promise<void>
  createSourceMapReader(): CDPConnection.SourceMap[] | Error
}

export namespace CDPConnection {
  export interface SourceMap {
    getSourceMapReader(): SourceMapConsumer
    getSources(): string[]
    getCDPSource(): string
  }

  export class CDPConnectionImpl implements CDPConnection {
    constructor(
      private readonly resolvedArgs: Arguments.ResolvedArguments,
      private readonly connection: Connection,
      private readonly vscodeDebuggerAdapter: VscodeDebuggerAdapter,
    ) {}

    getConnection(): Connection {
      return this.connection
    }

    async setInitialBreakpoints() {
      const debuggerAdapter = await this.connection.getDebuggerAdapter()
      const sourceMaps = this.createSourceMapReader()
      if (sourceMaps instanceof Error) return this.vscodeDebuggerAdapter.getLogger().data('Failed to create source map reader:', sourceMaps)
      const locations: Adapter.MultiLocation = {}

      for (const [filePath, breakpoints] of this.vscodeDebuggerAdapter.getBreakpointStore().entries()) {
        const relativeFilePath = path.relative(this.resolvedArgs.projectRoot, filePath)
        const sourceMap = sourceMaps.find(sourceMap => sourceMap.getSources().includes(relativeFilePath))
        if (!sourceMap) continue
        this.vscodeDebuggerAdapter.getLogger().data('Source map found:', {
          cdpSource: sourceMap.getCDPSource(),
          sources: sourceMap.getSources(),
          relativeFilePath,
          filePath,
        })

        sourceMap.getSourceMapReader().eachMapping((mapping) => {
          this.vscodeDebuggerAdapter.getLogger().data('Mapping:', mapping)
        })

        for (const breakpoint of breakpoints) {
          const transformedLocation = sourceMap.getSourceMapReader().generatedPositionFor({
            line: breakpoint.line,
            column: breakpoint.column ?? 0,
            source: relativeFilePath,
            bias: -1,
          })

          if (!locations[sourceMap.getCDPSource()]) {
            locations[sourceMap.getCDPSource()] = [
              {
                lineNumber: transformedLocation.line ?? 0,
                columnNumber: transformedLocation.column ?? 0,
              },
            ]
          }
          else {
            locations[sourceMap.getCDPSource()].push({
              lineNumber: transformedLocation.line ?? 0,
              columnNumber: transformedLocation.column ?? 0,
            })
          }
        }
      }

      this.vscodeDebuggerAdapter.getLogger().data('Setting initial breakpoints...', locations)
      const result = await debuggerAdapter.saveAllPossibleBreakpoints({ params: { locations } })
      if (!Adapter.Response.is(result)) return this.vscodeDebuggerAdapter.getLogger().data('Failed to set initial breakpoints:', result)
      this.vscodeDebuggerAdapter.getLogger().data('Initial breakpoints set.', result)
    }

    async runIfWaitingForDebugger(): Promise<void> {
      const debuggerAdapter = await this.connection.getRuntimeAdapter()
      if (!debuggerAdapter) return this.vscodeDebuggerAdapter.getLogger().getConsola().info('The debugger adapter is not found.')
      const result = await debuggerAdapter.runIfWaitingForDebugger({ params: {} })
      if (!Adapter.Response.is(result)) return this.vscodeDebuggerAdapter.getLogger().data('Failed to run if waiting for debugger:', result)
      this.vscodeDebuggerAdapter.getLogger().data('Running if waiting for debugger.', result)
    }

    createSourceMapReader(): SourceMap[] | Error {
      const buildProfileFilePath = path.resolve(this.resolvedArgs.projectRoot, 'build-profile.json5')
      if (!fs.existsSync(buildProfileFilePath)) return new Error(`Build profile file not found: ${buildProfileFilePath}`)
      else if (!fs.statSync(buildProfileFilePath).isFile()) return new Error(`${buildProfileFilePath} is not a file.`)

      const buildProfileParsedContent = JSON5.parse(fs.readFileSync(buildProfileFilePath, 'utf-8'))
      const moduleRoot: unknown = buildProfileParsedContent?.modules?.find((mod: Record<'name', string>) => mod.name === this.resolvedArgs.moduleName)?.srcPath
      if (!moduleRoot) return new Error(`Module "${this.resolvedArgs.moduleName}" is not found in build-profile.json5.`)
      if (typeof moduleRoot !== 'string') return new Error(`Module "${this.resolvedArgs.moduleName}" srcPath is not a string.`)

      const absoluteModuleRoot = path.resolve(this.resolvedArgs.projectRoot, moduleRoot)
      const sourceMapFilePath = path.resolve(absoluteModuleRoot, this.resolvedArgs.sourceMapFilePath)
      if (!fs.existsSync(sourceMapFilePath)) return new Error(`Source map file not found: "${sourceMapFilePath}"`)
      else if (!fs.statSync(sourceMapFilePath).isFile()) return new Error(`"${sourceMapFilePath}" is not a file.`)

      const sourceMapContents = fs.readFileSync(sourceMapFilePath, 'utf-8')
      return sourceMapContents.split('\n').map((line) => {
        const parsedLine = JSON.parse(line)
        if (typeof parsedLine !== 'object' || typeof parsedLine?.key !== 'string' || typeof parsedLine?.val !== 'object') return null

        const sourceMapReader = new SourceMapConsumer({
          version: parsedLine?.val?.version as 3,
          names: parsedLine?.val?.names as string[],
          sources: parsedLine?.val?.sources as string[],
          mappings: parsedLine?.val?.mappings as string,
        })

        return {
          getSourceMapReader: () => sourceMapReader,
          getSources: () => parsedLine?.val?.sources as string[],
          getCDPSource: () => parsedLine?.key as string,
        } satisfies CDPConnection.SourceMap
      }).filter(Boolean) as SourceMap[]
    }

    async enable() {
      await this.enableRuntimeNamespace(this.vscodeDebuggerAdapter)
      await this.enableDebuggerNamespace(this.vscodeDebuggerAdapter)
    }

    private async enableRuntimeNamespace(vscodeDebuggerAdapter: VscodeDebuggerAdapter) {
      const runtimeAdapter = await this.connection.getRuntimeAdapter()
      if (!runtimeAdapter) return vscodeDebuggerAdapter.getLogger().getConsola().info('The runtime adapter is not found.')
      const result = await runtimeAdapter.enable({ params: {} })
      if (!Adapter.Response.is(result)) return vscodeDebuggerAdapter.getLogger().data('Failed to enable runtime namespace:', result)
      vscodeDebuggerAdapter.getLogger().data('Runtime namespace enabled.', result)
      return runtimeAdapter
    }

    private async enableDebuggerNamespace(vscodeDebuggerAdapter: VscodeDebuggerAdapter) {
      const debuggerAdapter = await this.connection.getDebuggerAdapter()
      if (!debuggerAdapter) return vscodeDebuggerAdapter.getLogger().getConsola().info('The debugger adapter is not found.')
      const result = await debuggerAdapter.enable({
        params: { options: ['enableLaunchAccelerate'], maxScriptsCacheSize: 1.0e7 },
      })
      if (!Adapter.Response.is(result)) return vscodeDebuggerAdapter.getLogger().data('Failed to enable debugger namespace:', result)
      vscodeDebuggerAdapter.getLogger().data('Debugger namespace enabled.', result)
      return debuggerAdapter
    }
  }

  export async function create(resolvedArgs: Arguments.ResolvedArguments, identifier: `${string}.${string}.${string}`, vscodeDebuggerAdapter: VscodeDebuggerAdapter) {
    const connection = await createConnection({
      adapter: createWsAdapter(),
      abilityName: resolvedArgs.abilityName,
      controlPort: resolvedArgs.controlPort,
      devtoolsPort: resolvedArgs.devtoolsPort,
      identifier,
    })

    await connection.getDebuggerAdapter().then((debuggerAdapter) => {
      debuggerAdapter.onScriptParsed(scriptParsed => vscodeDebuggerAdapter.getLogger().data('Script parsed:', scriptParsed))
    })

    return new CDPConnectionImpl(resolvedArgs, connection, vscodeDebuggerAdapter)
  }
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
    /** The module name of the application. @default main */
    moduleName: string
    /** The source map file path of the application. @default build/default/cache/default/default@CompileArkTS/esmodule/debug/sourceMaps.json */
    sourceMapFilePath?: string
  }

  export type ResolvedArguments = Required<BaseArguments> & DebugProtocol.LaunchRequestArguments

  export function resolve(args: Arguments): ResolvedArguments {
    return {
      ...args,
      abilityName: args.abilityName ?? 'EntryAbility',
      controlPort: args.controlPort ?? 9230,
      devtoolsPort: args.devtoolsPort ?? 9229,
      sourceMapFilePath: args.sourceMapFilePath ?? 'build/default/cache/default/default@CompileArkTS/esmodule/debug/sourceMaps.json',
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
