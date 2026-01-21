export type Awaitable<T> = T | Promise<T>

export interface Disposable<T = void> {
  /** Dispose resources. */
  dispose(): Awaitable<T>
}

export namespace Disposable {
  export function from<T>(dispose: () => Awaitable<T>): Disposable<T> {
    return {
      dispose: async () => await dispose(),
    }
  }

  export class Registry<T = void> implements Disposable<PromiseSettledResult<Awaited<T>>[]> {
    private readonly _disposables: Disposable<T>[] = []

    push(...disposables: Disposable<T>[]): this {
      this._disposables.push(...disposables)
      return this
    }

    async dispose(): Promise<PromiseSettledResult<Awaited<T>>[]> {
      return await Promise.allSettled(this._disposables.map(disposable => disposable.dispose()))
    }

    get length(): number {
      return this._disposables.length
    }

    getDisposableRegistry(): readonly Disposable<T>[] {
      return Object.freeze(this._disposables)
    }
  }
}
