import type { Adapter } from './adapter'
import type { JsonException } from './errors'
import type { Awaitable } from './types'
import child_process from 'node:child_process'
import { IdentifierGenerator } from './identifier-generator'
import { Disposable } from './types'
import { sleep } from './utils'

export namespace Connection {
  export interface Options<TAdapter extends Adapter = Adapter> {
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
    adapter: Awaitable<Adapter.Factory<TAdapter>>
    /** The identifier of the ArkTS application. @example `com.example.app` */
    identifier: `${string}.${string}.${string}`
    /** The ability name of the application. @default EntryAbility */
    abilityName?: string
    /** The control port of the application. @default 9230 */
    controlPort?: number
    /** The devtools port of the application. @default 9229 */
    devtoolsPort?: number
  }

  export interface ResolvedOptions<TAdapter extends Adapter = Adapter> extends Omit<Required<Options<TAdapter>>, 'adapter'> {
    adapter: Adapter.Factory<TAdapter>
  }
}

export interface Connection<TAdapter extends Adapter = Adapter> extends Adapter, Disposable.Registry<unknown> {
  /** Get the adapter. */
  getAdapter(): TAdapter
  /** The PID of the application. */
  getPid(): string
  /** The identifier of the application. */
  getIdentifier(): string
  /** The ability name of the application. */
  getAbilityName(): string
  /** The devtools URL of the application. */
  getDevtoolsUrl(): string
  /** Generate a new identifier and return it. */
  generateIdentifier(): number
  /** Get the current identifier. */
  getCurrentIdentifier(): number
  /** Get the devtools port. */
  getDevtoolsPort(): number
  /** Get the control port. */
  getControlPort(): number
}

export async function createConnection<TAdapter extends Adapter = Adapter>(options: Connection.Options<TAdapter>): Promise<Connection<TAdapter>> {
  const resolvedOptions = await resolveOptions(options)

  await forceClearPorts(resolvedOptions)
  await restartApp(resolvedOptions)

  const pid = await waitForPid(resolvedOptions)

  await bindPort(resolvedOptions.devtoolsPort, `ark:${pid}@${resolvedOptions.identifier}`)

  // 略微等待，确保 9229 已经稳定后再绑定 9230
  await sleep(1_000)
  await bindPort(resolvedOptions.controlPort, `ark:${pid}@Debugger`)

  const connection = new ConnectionImpl(resolvedOptions, pid)
  const adapter = await resolvedOptions.adapter.onInitialize?.(connection as Connection, resolvedOptions)
  connection.setAdapter(adapter)
  return connection
}

class ConnectionImpl<TAdapter extends Adapter = Adapter> extends IdentifierGenerator implements Connection<TAdapter> {
  constructor(
    private readonly options: Connection.ResolvedOptions<TAdapter>,
    private readonly pid: string,
  ) {
    super()
    if (options.adapter.dispose) this.push(Disposable.from(async () => await options.adapter.dispose?.()))
  }

  private _adapter: Adapter | undefined

  setAdapter(adapter: Adapter): this {
    this._adapter = adapter
    return this
  }

  getConnection(): Connection {
    return this as Connection
  }

  onNotification<Id extends number = number, Params = unknown>(callback: (notification: Adapter.Notification<Id, Params> | JsonException) => void): Disposable {
    return this.getAdapter()!.onNotification(callback)
  }

  onRequest<Id extends number = number, Result = unknown, ErrorData = unknown>(callback: (response: Adapter.Response<Id, Result> | Adapter.Error<Id, ErrorData> | JsonException) => void): Disposable {
    return this.getAdapter()!.onRequest(callback)
  }

  getAdapter(): TAdapter {
    return this._adapter as TAdapter
  }

  sendRequest<Id extends number = number, Params = unknown, Result = unknown, ErrorData = unknown>(request: Adapter.OptionalNotification<Id, Params>): Promise<Adapter.Response<Id, Result> | Adapter.Error<Id, ErrorData>> {
    return this.getAdapter()!.sendRequest(request)
  }

  sendNotification<Id extends number = number, Params = unknown>(notification: Adapter.OptionalNotification<Id, Params>): Promise<void> {
    return this.getAdapter()!.sendNotification(notification)
  }

  async getDebuggerAdapter(): Promise<Adapter.Debugger> {
    return this.getAdapter()!.getDebuggerAdapter()
  }

  async getRuntimeAdapter(): Promise<Adapter.Runtime> {
    return this.getAdapter()!.getRuntimeAdapter()
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

  async dispose(): Promise<PromiseSettledResult<Awaited<unknown>>[]> {
    await forceClearPorts(this.options)
    return await super.dispose()
  }
}

export async function resolveOptions<TAdapter extends Adapter = Adapter>(options: Connection.Options<TAdapter>): Promise<Connection.ResolvedOptions<TAdapter>> {
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
