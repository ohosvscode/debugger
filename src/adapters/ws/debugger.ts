import type { WsAdapterImpl } from './adapter'
import { Adapter } from '../../adapter'
import { Disposable } from '../../types'

export class WsDebuggerAdapter implements Adapter.Debugger {
  constructor(private readonly adapter: WsAdapterImpl) {}

  enable<Id extends number = number>(request: Adapter.Debugger.Enable.Request<Id>): Promise<Adapter.Debugger.Enable.Response<Id> | Adapter.Error<Id, unknown>> {
    return this.adapter.sendRequest({
      ...request,
      method: 'Debugger.enable',
    })
  }

  disable<Id extends number = number>(request: Adapter.Debugger.Disable.Request<Id>): Promise<Adapter.Debugger.Disable.Response<Id> | Adapter.Error<Id, unknown>> {
    return this.adapter.sendRequest({
      ...request,
      method: 'Debugger.disable',
    })
  }

  removeBreakpointsByUrl<Id extends number = number>(request: Adapter.Debugger.RemoveBreakpointsByUrl.Request<Id>): Promise<Adapter.Debugger.RemoveBreakpointsByUrl.Response<Id> | Adapter.Error<Id, unknown>> {
    return this.adapter.sendRequest({
      ...request,
      method: 'Debugger.removeBreakpointsByUrl',
    })
  }

  getPossibleAndSetBreakpointByUrl<Id extends number = number>(request: Adapter.Debugger.GetPossibleAndSetBreakpointByUrl.Request<Id>): Promise<Adapter.Debugger.GetPossibleAndSetBreakpointByUrl.Response<Id> | Adapter.Error<Id, unknown>> {
    return this.adapter.sendRequest({
      ...request,
      method: 'Debugger.getPossibleAndSetBreakpointByUrl',
    })
  }

  saveAllPossibleBreakpoints<Id extends number = number>(request: Adapter.Debugger.SaveAllPossibleBreakpoints.Request<Id>): Promise<Adapter.Debugger.SaveAllPossibleBreakpoints.Response<Id> | Adapter.Error<Id, unknown>> {
    return this.adapter.sendRequest({
      ...request,
      method: 'Debugger.saveAllPossibleBreakpoints',
    })
  }

  onScriptParsed<Id extends number = number>(callbacks: Adapter.Debugger.ScriptParsed.Callback<Id> | ((notification: Adapter.Debugger.ScriptParsed.Notification<Id>) => void), disposeWhenCountExceeded?: number): Disposable {
    if (typeof callbacks === 'function') {
      const disposable = this.adapter.onNotification((notification) => {
        if (!Adapter.OptionalNotification.is(notification)) return
        if (notification.method !== 'Debugger.scriptParsed') return
        callbacks(notification as Adapter.Debugger.ScriptParsed.Notification<Id>)
      })
      return disposable
    }
    else if (typeof callbacks === 'object' && callbacks !== null) {
      const notifications = new Set<Adapter.Debugger.ScriptParsed.Notification<Id>>()
      const disposable = this.adapter.onNotification((notification) => {
        if (!Adapter.OptionalNotification.is(notification)) return
        if (notification.method !== 'Debugger.scriptParsed') return
        notifications.add(notification as Adapter.Debugger.ScriptParsed.Notification<Id>)
        callbacks.onScriptParsed?.(notification as Adapter.Debugger.ScriptParsed.Notification<Id>)
        if (typeof disposeWhenCountExceeded === 'number' && notifications.size >= disposeWhenCountExceeded) {
          callbacks.onExceeded?.(Array.from(notifications))
          disposable.dispose()
        }
      })
      return Disposable.from(() => {
        disposable.dispose()
        notifications.clear()
      })
    }
    else {
      throw new TypeError(`Invalid Debugger.ScriptParsed onScriptParsed() argument.`)
    }
  }

  onPaused<Id extends number = number>(callback: (notification: Adapter.Debugger.Paused.Notification<Id>) => void): Disposable {
    return this.adapter.onNotification((notification) => {
      if (!Adapter.OptionalNotification.is(notification)) return
      if (notification.method !== 'Debugger.paused') return
      callback(notification as Adapter.Debugger.Paused.Notification<Id>)
    })
  }

  resume<Id extends number = number>(request: Adapter.Debugger.Resume.Request<Id>): Promise<Adapter.Debugger.Resume.Response<Id> | Adapter.Error<Id, unknown>> {
    return this.adapter.sendRequest({
      ...request,
      method: 'Debugger.resume',
    })
  }
}
