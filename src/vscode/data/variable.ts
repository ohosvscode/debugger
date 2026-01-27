import type { DebugProtocol } from '@vscode/debugprotocol'

export namespace Variable {
  class LocalVariable<T extends Variable.Value = Variable.Value> {
    constructor(private readonly value: T) {}

    getValue(): T {
      return this.value
    }
  }

  class RemoteVariable<T extends DebugProtocol.Variable[] = DebugProtocol.Variable[]> {
    constructor(
      private readonly executor: (variablesReference: number) => Promise<T> | T,
    ) {}

    getValue(variablesReference: number): Promise<T> | T {
      return this.executor(variablesReference)
    }
  }

  export type Value = object | Record<string, unknown>

  export interface RemoteValue {
    objectId: number | string
  }

  export interface Local<T extends Variable.Value = Variable.Value> {
    getValue(): T
  }

  export namespace Local {
    export function is(value: Variable.Variable): value is LocalVariable {
      return value instanceof LocalVariable
    }
  }

  export interface Remote<T extends DebugProtocol.Variable[] = DebugProtocol.Variable[]> {
    getValue(variablesReference: number): Promise<T> | T
  }

  export namespace Remote {
    export function is(value: Variable.Variable): value is RemoteVariable {
      return value instanceof RemoteVariable
    }
  }

  export type Variable = Local | Remote

  export function fromLocal<T extends Variable.Value = Variable.Value>(value: T): LocalVariable<T> {
    return new LocalVariable(value)
  }

  export function fromRemote<T extends DebugProtocol.Variable[] = DebugProtocol.Variable[]>(executor: (variablesReference: number) => Promise<T> | T): RemoteVariable<T> {
    return new RemoteVariable(executor)
  }
}
