import type { DebugProtocol } from '@vscode/debugprotocol'
import { InitializedEvent, TerminatedEvent } from '@vscode/debugadapter'
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
    await cdp.enable()
    await cdp.setInitialBreakpoints()
    await cdp.runIfWaitingForDebugger()
    this.sendResponse(response)
  }

  protected setBreakPointsRequest(response: DebugProtocol.SetBreakpointsResponse, args: DebugProtocol.SetBreakpointsArguments): void {
    if (!args.source?.path) return this.sendErrorResponse(response, 400, 'Source path is required.')
    this.getBreakpointStore().set(args.source.path, args.breakpoints ?? [])
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

  protected variablesRequest(response: DebugProtocol.VariablesResponse, args: DebugProtocol.VariablesArguments): void {
    const value = this.getVariableStore().get(args.variablesReference)
    if (!value) return this.sendErrorResponse(response, 400, 'Unknown variablesReference')
    response.body = {
      variables: Object.entries(value).map(
        ([name, v]) => ({
          name,
          value: typeof v === 'object' ? JSON.stringify(v) : String(v),
          variablesReference: typeof v === 'object' && v !== null ? this.getVariableStore().add(v) : 0,
        } satisfies DebugProtocol.Variable),
      ),
    }
    this.sendResponse(response)
  }
}
