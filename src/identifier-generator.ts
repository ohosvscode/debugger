import { Disposable } from './types'

export abstract class IdentifierGenerator extends Disposable.Registry<unknown> {
  private _id: number = 0

  generateIdentifier(): number {
    return this._id++
  }

  getCurrentIdentifier(): number {
    return this._id
  }
}
