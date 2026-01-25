import type { DebugProtocol } from '@vscode/debugprotocol'
import type { Awaitable, Disposable } from '../../types'

export class BreakpointStore implements Disposable {
  private readonly _map = new Map<string, Set<DebugProtocol.SourceBreakpoint>>()

  set(filePath: string, breakpoints: Set<DebugProtocol.SourceBreakpoint> | DebugProtocol.SourceBreakpoint[]) {
    this._map.set(filePath, breakpoints instanceof Set ? breakpoints : new Set(breakpoints))
  }

  delete(filePath: string) {
    this._map.delete(filePath)
  }

  get(filePath: string) {
    return this._map.get(filePath)
  }

  entries() {
    return this._map.entries()
  }

  get length() {
    return this._map.size
  }

  dispose(): Awaitable<void> {
    this._map.clear()
  }
}
