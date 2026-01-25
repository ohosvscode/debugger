import type { Connection } from '../connection'
import type { CDPConnection } from './launch-request'
import { DebugSession } from '@vscode/debugadapter'
import { BreakpointStore } from './data/breakpoint-store'
import { VariableStore } from './data/variable-store'
import { VscodeDebuggerAdapterLogger } from './debugger-logger'

export abstract class AbstractDebugSession extends DebugSession {
  private readonly _logger = VscodeDebuggerAdapterLogger.from(this)
  private readonly _store = new VariableStore()
  private readonly _breakpointStore = new BreakpointStore()
  private _cdpConnection: CDPConnection | undefined

  getConnection(): Connection | undefined {
    return this._cdpConnection?.getConnection()
  }

  readSourceMap(): CDPConnection.SourceMap[] | Error {
    return this._cdpConnection?.createSourceMapReader() ?? []
  }

  setCDPConnection(cdpConnection: CDPConnection): void {
    this._cdpConnection = cdpConnection
  }

  async disposeConnection(): Promise<void> {
    await this.getConnection()?.dispose()
    this._store.dispose()
    this._breakpointStore.dispose()
    this._cdpConnection = undefined
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
