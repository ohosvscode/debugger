import type { Adapter } from './adapter'
import type { Awaitable, Disposable } from './types'
import child_process from 'node:child_process'
import { BaseException } from './errors/base-exception'
import { IdentifierGenerator } from './identifier-generator'
import { sleep } from './utils'

export namespace Connection {
  export interface Options {
    /**
     * An adapter instance.
     *
     * @example
     * ```typescript
     * import { createWsAdapter } from '@arkts/debugger'
     * import WebSocket from 'ws'
     *
     * const adapter = createWsAdapter(new WebSocket('ws://localhost:9229'))
     * const connection = createConnection({ adapter, ... })
     * ```
     */
    adapter: Awaitable<Adapter.Factory>
    /** The identifier of the ArkTS application. @example `com.example.app` */
    identifier: `${string}.${string}.${string}`
    /** The ability name of the application. @default EntryAbility */
    abilityName?: string
    /** The control port of the application. @default 9230 */
    controlPort?: number
    /** The devtools port of the application. @default 9229 */
    devtoolsPort?: number
  }

  export interface ResolvedOptions extends Omit<Required<Options>, 'adapter'> {
    adapter: Adapter.Factory
  }

  export class DisposeError extends BaseException {
    constructor(private readonly errors: unknown[]) {
      super(`Dispose connection failed!`)
    }

    getErrors(): unknown[] {
      return this.errors
    }
  }
}

export interface Connection extends Adapter, Disposable {
  /** The PID of the application. */
  getPid(): string
  /** The identifier of the application. */
  getIdentifier(): string
  /** The ability name of the application. */
  getAbilityName(): string
  /** The devtools URL of the application. */
  getDevtoolsUrl(): string
  /** Dispose the connection. */
  dispose(): Promise<void>
  /** Generate a new identifier and return it. */
  generateIdentifier(): number
  /** Get the current identifier. */
  getCurrentIdentifier(): number
  /** Get the devtools port. */
  getDevtoolsPort(): number
  /** Get the control port. */
  getControlPort(): number
}

export async function createConnection(options: Connection.Options): Promise<Connection> {
  const resolvedOptions = await resolveOptions(options)

  await forceClearPorts(resolvedOptions)
  await restartApp(resolvedOptions)

  const pid = await waitForPid(resolvedOptions)

  await bindPort(resolvedOptions.devtoolsPort, `ark:${pid}@${resolvedOptions.identifier}`)

  // 略微等待，确保 9229 已经稳定后再绑定 9230
  await sleep(1_000)
  await bindPort(resolvedOptions.controlPort, `ark:${pid}@Debugger`)

  const connection = new ConnectionImpl(resolvedOptions, pid)
  const adapter = await resolvedOptions.adapter.onInitialize?.(connection, resolvedOptions)
  connection.setAdapter(adapter)
  return connection
}

class ConnectionImpl extends IdentifierGenerator implements Connection {
  constructor(
    private readonly options: Connection.ResolvedOptions,
    private readonly pid: string,
  ) { super() }

  private _adapter: Adapter | undefined

  setAdapter(adapter: Adapter): this {
    this._adapter = adapter
    return this
  }

  getConnection(): Connection {
    return this
  }

  getAdapter(): Adapter {
    if (!this._adapter) throw new Error('Adapter not initialized')
    return this._adapter
  }

  sendRequest<Id extends number = number, Params = unknown, Result = unknown, ErrorData = unknown>(request: Adapter.OptionalNotification<Id, Params>): Promise<Adapter.Response<Id, Result> | Adapter.Error<Id, ErrorData>> {
    return this.getAdapter().sendRequest(request)
  }

  sendNotification<Id extends number = number, Params = unknown>(notification: Adapter.OptionalNotification<Id, Params>): Promise<void> {
    return this.getAdapter().sendNotification(notification)
  }

  async getDebuggerAdapter(): Promise<Adapter.Debugger> {
    return this.getAdapter().getDebuggerAdapter()
  }

  async getRuntimeAdapter(): Promise<Adapter.Runtime> {
    return this.getAdapter().getRuntimeAdapter()
  }

  getPid(): string {
    return this.pid
  }

  getDevtoolsPort(): number {
    return this.options.devtoolsPort
  }

  getControlPort(): number {
    return this.options.controlPort
  }

  getIdentifier(): string {
    return this.options.identifier
  }

  getAbilityName(): string {
    return this.options.abilityName
  }

  getDevtoolsUrl(): string {
    return `devtools://devtools/bundled/inspector.html?v8only=true&ws=127.0.0.1:${this.options.controlPort}`
  }

  async dispose(): Promise<void> {
    const errors: unknown[] = []

    try {
      await this.options.adapter.dispose?.()
    }
    catch (error) {
      errors.push(error)
    }

    try {
      await forceClearPorts(this.options)
    }
    catch (error) {
      errors.push(error)
    }

    if (errors.length > 0) {
      throw new Connection.DisposeError(errors)
    }
  }
}

export async function resolveOptions(options: Connection.Options): Promise<Connection.ResolvedOptions> {
  return {
    ...options,
    adapter: await options.adapter,
    abilityName: options.abilityName ?? 'EntryAbility',
    controlPort: options.controlPort ?? 9230,
    devtoolsPort: options.devtoolsPort ?? 9229,
  }
}

async function runHdc(args: string[], command = 'hdc'): Promise<string> {
  return new Promise((resolve, reject) => {
    child_process.execFile(command, args, { encoding: 'utf8' }, (err, stdout, stderr) => {
      if (err) return reject(err)
      resolve(`${stdout ?? ''}${stderr ?? ''}`.trim())
    })
  })
}

async function forceClearPorts(resolvedOptions: Connection.ResolvedOptions): Promise<void> {
  let list = ''
  try {
    list = await runHdc(['fport', 'ls'])
  }
  catch {
    return
  }

  const lines = list.split(/\r?\n/)
  const targets = [resolvedOptions.devtoolsPort, resolvedOptions.controlPort].map(port => `tcp:${port}`)

  for (const line of lines) {
    if (!targets.some(target => line.includes(target))) continue

    const tokens = line.trim().split(/\s+/)
    const port = tokens[1]
    const task = tokens[2]

    if (port && task) {
      try {
        await runHdc(['fport', 'rm', port, task])
      }
      catch {
        // best effort
      }
    }
  }
}

async function restartApp(resolvedOptions: Connection.ResolvedOptions): Promise<void> {
  await runHdc(['shell', 'aa', 'force-stop', resolvedOptions.identifier])
  await runHdc(['shell', 'aa', 'start', '-a', resolvedOptions.abilityName, '-b', resolvedOptions.identifier, '-D'])
}

async function waitForPid(resolvedOptions: Connection.ResolvedOptions, timeoutMs = 10_000): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = child_process.spawn('hdc', ['track-jpid'])
    let resolved = false

    const cleanup = (error?: unknown) => {
      if (child.exitCode === null) child.kill()
      if (!resolved && error) reject(error instanceof Error ? error : new Error(String(error)))
    }

    const timer = setTimeout(() => {
      cleanup(new Error('PID 获取超时'))
    }, timeoutMs)

    child.stdout.on('data', (chunk) => {
      const lines = chunk.toString('utf8').split(/\r?\n/)
      for (const line of lines) {
        if (!line.includes(resolvedOptions.identifier)) continue

        const pid = line.trim().split(/\s+/)[0]
        if (pid) {
          resolved = true
          clearTimeout(timer)
          cleanup()
          resolve(pid)
          return
        }
      }
    })

    child.on('error', err => cleanup(err))
    child.on('close', (code) => {
      if (resolved) return
      clearTimeout(timer)
      cleanup(new Error(`track-jpid 退出, code=${code ?? 'unknown'}`))
    })
  })
}

async function bindPort(localPort: number, remote: string): Promise<void> {
  const output = await runHdc(['fport', `tcp:${localPort}`, remote])
  if (output.includes('Fail')) throw new Error(`端口映射失败: ${output}`)
}
