import type { Connection } from '../connection'
import { DebugSession } from '@vscode/debugadapter'
import { BreakpointStore } from './data/breakpoint-store'
import { VariableStore } from './data/variable-store'
import { VscodeDebuggerAdapterLogger } from './debugger-logger'

export abstract class AbstractDebugSession extends DebugSession {
  private readonly _logger = VscodeDebuggerAdapterLogger.from(this)
  private readonly _store = new VariableStore()
  private readonly _breakpointStore = new BreakpointStore()
  private _connection: Connection | undefined

  getConnection(): Connection | undefined {
    return this._connection
  }

  setConnection(connection: Connection): void {
    this._connection = connection
  }

  async disposeConnection(): Promise<void> {
    await this._connection?.dispose()
    this._store.dispose()
    this._breakpointStore.dispose()
    this._connection = undefined
  }

  getLogger(): VscodeDebuggerAdapterLogger {
    return this._logger
  }

  getVariableStore(): VariableStore {
    return this._store
  }

  getBreakpointStore(): BreakpointStore {
    return this._breakpointStore
  }
}
