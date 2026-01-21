export type Awaitable<T> = T | Promise<T>

export interface Disposable<T = void> {
  /** Dispose resources. */
  dispose(): Awaitable<T>
}
