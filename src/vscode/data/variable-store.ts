import type { Awaitable, Disposable } from '../../types'

export class VariableStore implements Disposable {
  private next = 1
  private map = new Map<number, unknown>()

  add<T>(value: T) {
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
