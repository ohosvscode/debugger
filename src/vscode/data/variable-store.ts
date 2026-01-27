import type { Awaitable, Disposable } from '../../types'
import type { Variable } from './variable'

export class VariableStore implements Disposable {
  private next = 1
  private map = new Map<number, Variable.Local | Variable.Remote>()

  add<T extends Variable.Variable>(value: T): number {
    const id = this.next++
    this.map.set(id, value)
    return id
  }

  get(id: number) {
    return this.map.get(id)
  }

  dispose(): Awaitable<void> {
    this.map.clear()
    this.next = 1
  }
}
