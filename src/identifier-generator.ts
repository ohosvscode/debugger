export abstract class IdentifierGenerator {
  private _id: number = 0

  generateIdentifier(): number {
    return this._id++
  }

  getCurrentIdentifier(): number {
    return this._id
  }
}
