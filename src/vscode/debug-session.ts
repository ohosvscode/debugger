import type { Connection } from '../connection'
import type { PausedState } from './data/paused-state'
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
  private _isLaunched = false
  private _projectRoot: string
  private _currentPausedState: PausedState | undefined

  getProjectRoot(): string {
    return this._projectRoot
  }

  setProjectRoot(projectRoot: string): void {
    this._projectRoot = projectRoot
  }

  getConnection(): Connection | undefined {
    return this._cdpConnection?.getConnection()
  }

  readSourceMap(): CDPConnection.SourceMap[] | Error {
    return this._cdpConnection?.createSourceMapReader() ?? []
  }

  setCDPConnection(cdpConnection: CDPConnection): void {
    this._cdpConnection = cdpConnection
  }

  setIsLaunched(isLaunched: boolean): void {
    this._isLaunched = isLaunched
  }

  isLaunched(): boolean {
    return this._isLaunched
  }

  async disposeConnection(): Promise<void> {
    await this.getConnection()?.dispose()
    this._store.dispose()
    this._breakpointStore.dispose()
    this._cdpConnection = undefined
    this._isLaunched = false
  }

  getLogger(): VscodeDebuggerAdapterLogger {
    return this._logger as VscodeDebuggerAdapterLogger
  }

  getVariableStore(): VariableStore {
    return this._store
  }

  getBreakpointStore(): BreakpointStore {
    return this._breakpointStore
  }

  getCurrentPausedState(): PausedState | undefined {
    return this._currentPausedState
  }

  setCurrentPausedState(pausedState: PausedState): void {
    this._currentPausedState = pausedState
  }
}
