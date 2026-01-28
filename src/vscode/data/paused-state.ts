import type { DebugProtocol } from '@vscode/debugprotocol'
import type { VscodeDebuggerAdapter } from '../debugger-adapter'
import path from 'node:path'
import { Adapter } from '../../adapter'
import { IdentifierGenerator } from '../../identifier-generator'
import { Variable } from './variable'

export class PausedState extends IdentifierGenerator {
  constructor(
    private readonly params: Adapter.Debugger.Paused.Params,
    private readonly debuggerAdapter: VscodeDebuggerAdapter,
  ) {
    super()
  }

  getCallFrames(): Adapter.Debugger.Paused.CallFrame[] {
    return this.params.callFrames
  }

  getScopeChainsByCallFrame(callFrame?: Adapter.Debugger.Paused.CallFrame): Adapter.Debugger.Paused.ScopeChain[] {
    if (callFrame) return this.params.callFrames.find(cf => cf.callFrameId === callFrame.callFrameId)?.scopeChain ?? []
    else return this.params.callFrames?.[0]?.scopeChain ?? []
  }

  static transformCallFrames(state: PausedState): DebugProtocol.StackFrame[] {
    const sourceMaps = state.debuggerAdapter.readSourceMap()
    if (sourceMaps instanceof Error) return []

    return state.getCallFrames().map((callFrame) => {
      const sourceMap = sourceMaps.find(sourceMap => sourceMap.getCDPSource() === callFrame.url)
      if (!sourceMap) return null

      const sourcePosition = sourceMap.getSourceMapReader().originalPositionFor({
        line: callFrame.location.lineNumber,
        column: callFrame.location.columnNumber,
        bias: -1,
      })

      if (!sourcePosition.line || !sourcePosition.column || !sourcePosition.source) return null
      state.debuggerAdapter.getLogger().data('Source position:', sourcePosition)

      return {
        id: !Number.isNaN(Number(callFrame.callFrameId)) ? Number(callFrame.callFrameId) : state.generateIdentifier(),
        name: callFrame.functionName ?? '<anonymous>',
        line: sourcePosition.line,
        column: sourcePosition.column,
        source: {
          path: path.resolve(state.debuggerAdapter.getProjectRoot(), sourcePosition.source),
        },
      } satisfies DebugProtocol.StackFrame
    }).filter(Boolean) as DebugProtocol.StackFrame[]
  }

  private static async getVariablesByGetterOrSetter(state: PausedState, property: Adapter.Runtime.GetProperties.PropertyDescriptor): Promise<number> {
    return state.debuggerAdapter.getVariableStore().add(
      Variable.fromRemote(async () => {
        const variables: DebugProtocol.Variable[] = []

        if (property.get) {
          variables.push({
            name: property.name ?? '<anonymous>',
            value: property.get.unserializableValue ?? property.get.description ?? '<anonymous>',
            variablesReference: property.get.objectId
              ? await this.getVariablesReferenceByObjectId(state, property.get.objectId)
              : 0,
            type: property.get.type,
          })
        }

        if (property.set) {
          variables.push({
            name: property.name ?? '<anonymous>',
            value: property.set.unserializableValue ?? property.set.description ?? '<anonymous>',
            variablesReference: property.set.objectId
              ? await this.getVariablesReferenceByObjectId(state, property.set.objectId)
              : 0,
            type: property.set.type,
          })
        }

        return variables
      }),
    )
  }

  private static async getVariablesReferenceByObjectId(state: PausedState, objectId: string): Promise<number> {
    return state.debuggerAdapter.getVariableStore().add(
      Variable.fromRemote(async () => {
        const variables: DebugProtocol.Variable[] = []
        const runtimeAdapter = await state.debuggerAdapter.getConnection()?.getRuntimeAdapter()
        if (!runtimeAdapter) return variables
        const result = await runtimeAdapter.getProperties({ params: { objectId } })
        if (Adapter.Error.is(result)) return variables

        for (const property of result.result.result) {
          variables.push({
            name: property.name ?? '<anonymous>',
            value: property.value?.unserializableValue ?? property.value?.description ?? '<anonymous>',
            variablesReference: property.value?.type === 'number'
              ? 0
              : property.value?.objectId
                ? await this.getVariablesReferenceByObjectId(state, property.value.objectId)
                : (property.get || property.set)
                    ? await this.getVariablesByGetterOrSetter(state, property)
                    : 0,
          })
        }

        return variables
      }),
    )
  }

  static transformScopes(state: PausedState): Promise<DebugProtocol.Scope[]> {
    return Promise.all(
      state.getScopeChainsByCallFrame().map(
        async (scopeChain) => {
          return {
            name: scopeChain.type as string,
            variablesReference:
            scopeChain.object.objectId
              ? await this.getVariablesReferenceByObjectId(state, scopeChain.object.objectId)
              : 0,
            expensive: false,
          } satisfies DebugProtocol.Scope
        },
      ),
    ).then(async (scopes) => {
      return scopes.concat([
        {
          name: 'this',
          expensive: false,
          variablesReference: state.getCallFrames()?.[0].this.objectId
            ? await this.getVariablesReferenceByObjectId(state, state.getCallFrames()?.[0].this.objectId)
            : 0,
        },
      ])
    })
  }
}
