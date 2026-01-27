import type { DebugProtocol } from '@vscode/debugprotocol'
import { InitializedEvent, TerminatedEvent } from '@vscode/debugadapter'
import { SetBreakpoints } from './breakpoints'
import { PausedState } from './data/paused-state'
import { Variable } from './data/variable'
import { AbstractDebugSession } from './debug-session'
import * as DisconnectRequest from './disconnect-request'
import { CDPConnection, Arguments as LaunchRequestArguments } from './launch-request'

export class VscodeDebuggerAdapter extends AbstractDebugSession {
  protected async initializeRequest(response: DebugProtocol.InitializeResponse) {
    this.sendResponse(response)
    this.sendEvent(new InitializedEvent())
  }

  protected async launchRequest(response: DebugProtocol.LaunchResponse, args: LaunchRequestArguments) {
    const resolvedArgs = LaunchRequestArguments.resolve(args)
    const identifier = LaunchRequestArguments.readIdentifierByProjectRoot(resolvedArgs.projectRoot)
    if (identifier instanceof Error) return this.sendErrorResponse(response, 400, identifier.message)
    const cdp = await CDPConnection.create(resolvedArgs, identifier, this)
    this.setCDPConnection(cdp)
    this.setProjectRoot(resolvedArgs.projectRoot)
    cdp.startListenPausedEvent()
    await cdp.enable()
    await cdp.setInitialBreakpoints()
    await cdp.runIfWaitingForDebugger()
    this.setIsLaunched(true)
    this.sendResponse(response)
  }

  protected async setBreakPointsRequest(response: DebugProtocol.SetBreakpointsResponse, args: DebugProtocol.SetBreakpointsArguments) {
    if (!args.source?.path) return this.sendErrorResponse(response, 400, 'Source path is required.')
    this.getBreakpointStore().set(args.source.path, args.breakpoints ?? [])
    if (!this.isLaunched()) return this.sendResponse(response)
    const locations = SetBreakpoints.buildUrlLocation(this)
    if (locations instanceof Error) return this.sendErrorResponse(response, 400, locations.message)
    const debuggerAdapter = await this.getConnection()?.getDebuggerAdapter()
    if (locations.length === 0) {
      const cdpSource = SetBreakpoints.getCDPSource(this, args.source.path, locations.getSourceMaps())
      if (cdpSource instanceof Error) return this.sendErrorResponse(response, 400, cdpSource.message)
      await debuggerAdapter?.removeBreakpointsByUrl({ params: { url: cdpSource } })
    }
    else {
      await debuggerAdapter?.getPossibleAndSetBreakpointByUrl({ params: { locations } })
    }
    this.sendResponse(response)
  }

  protected stackTraceRequest(response: DebugProtocol.StackTraceResponse): void {
    const pausedState = this.getCurrentPausedState()
    if (!pausedState) return this.sendErrorResponse(response, 400, 'No paused state found.')
    response.body = { stackFrames: PausedState.transformCallFrames(pausedState) }
    this.sendResponse(response)
  }

  protected threadsRequest(response: DebugProtocol.ThreadsResponse): void {
    response.body = {
      threads: [
        { id: 1, name: 'Main Thread' },
      ],
    }
    this.sendResponse(response)
  }

  protected async scopesRequest(response: DebugProtocol.ScopesResponse): Promise<void> {
    const pausedState = this.getCurrentPausedState()
    if (!pausedState) return this.sendErrorResponse(response, 400, 'No paused state found.')
    response.body = {
      scopes: await PausedState.transformScopes(pausedState),
    }
    this.sendResponse(response)
  }

  protected async disconnectRequest(response: DebugProtocol.DisconnectResponse) {
    try {
      if (this.getConnection()) await DisconnectRequest.disposeConnection(this)
      this.sendResponse(response)
      this.sendEvent(new TerminatedEvent())
    }
    catch (error) {
      this.sendErrorResponse(response, 500, error instanceof Error ? error.message : 'Unknown error')
    }
    finally {
      await this.disposeConnection()
    }
  }

  protected async continueRequest(response: DebugProtocol.ContinueResponse) {
    const debuggerAdapter = await this.getConnection()?.getDebuggerAdapter()
    if (!debuggerAdapter) return this.sendErrorResponse(response, 400, 'Debugger adapter is not found.')
    await debuggerAdapter.resume({ params: {} })
    this.sendResponse(response)
  }

  protected async variablesRequest(response: DebugProtocol.VariablesResponse, args: DebugProtocol.VariablesArguments): Promise<void> {
    const variable = this.getVariableStore().get(args.variablesReference)
    if (!variable) return this.sendResponse(response)
    const variables: DebugProtocol.Variable[] = []

    if (Variable.Remote.is(variable)) {
      variables.push(...await variable.getValue(args.variablesReference))
    }
    else if (Variable.Local.is(variable)) {
      for (const [name, v] of Object.entries(variable.getValue())) {
        variables.push({
          name,
          value: typeof v === 'object' ? JSON.stringify(v) : String(v),
          variablesReference: typeof v === 'object' && v !== null ? this.getVariableStore().add(Variable.fromLocal(v)) : 0,
        })
      }
    }

    response.body = {
      variables,
    }
    this.sendResponse(response)
  }
}
