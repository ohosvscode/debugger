import type { ConsolaInstance, LogObject } from 'consola'
import type { AbstractDebugSession } from './debug-session'
import { OutputEvent } from '@vscode/debugadapter'
import { createConsola } from 'consola'
import { blue, dim, gray, green, red, yellow } from 'kleur/colors'

export interface VscodeDebuggerAdapterLogger {
  getConsola(): ConsolaInstance
  data<T>(message: string, data: T): void
}

export namespace VscodeDebuggerAdapterLogger {
  class VscodeDebuggerAdapterLoggerImpl {
    private readonly consola = createConsola({
      reporters: [
        {
          log: (logObj) => {
            switch (logObj.type) {
              case 'log': {
                const { colored, plain } = this.formatMessages(logObj, '📅')
                this.sendToAdapter(plain, 'stdout')
                console.log(gray(colored))
                break
              }
              case 'warn': {
                const { colored, plain } = this.formatMessages(logObj, '⚠️')
                this.sendToAdapter(plain, 'stderr')
                console.error(yellow(colored))
                break
              }
              case 'info': {
                const { colored, plain } = this.formatMessages(logObj, '🔥')
                this.sendToAdapter(plain, 'stdout')
                console.log(blue(colored))
                break
              }
              case 'success':
              case 'ready':
              case 'start': {
                const { colored, plain } = this.formatMessages(logObj, '✅')
                this.sendToAdapter(plain, 'stdout')
                console.log(green(colored))
                break
              }
              case 'fail':
              case 'fatal':
              case 'error': {
                const { colored, plain } = this.formatMessages(logObj, '❌')
                this.sendToAdapter(plain, 'stderr')
                console.error(red(colored))
                break
              }
              case 'debug':
              case 'verbose':
              case 'trace': {
                if (!this.debug) return
                const { colored, plain } = this.formatMessages(logObj, '🐛')
                this.sendToAdapter(plain, 'console')
                console.log(gray(colored))
                break
              }
              case 'box': {
                const { colored, plain } = this.formatMessages(logObj, '📦')
                this.sendToAdapter(plain, 'stdout')
                console.log(gray(colored))
                break
              }
            }
          },
        },
      ],
    })

    constructor(private readonly session: AbstractDebugSession) {}

    protected debug: boolean = false

    private getPrefix(): string {
      if (!this.session.getConnection()) return ''
      return `${this.session.getConnection()!.getIdentifier() ?? 'Unknown Identifier'}:${this.session.getConnection()!.getAbilityName() ?? 'Unknown Ability Name'}`
    }

    private sendToAdapter(body: string, category: 'console' | 'stdout' | 'stderr') {
      this.session.sendEvent(new OutputEvent(`${body}\n`, category))
    }

    private safeStringify<T>(value: T): string {
      try { return JSON.stringify(value) }
      catch { return String(value) }
    }

    private toString(logObj: LogObject): string {
      if (logObj.message) return logObj.message
      if (logObj.args.length === 0) return this.safeStringify(logObj)
      return logObj.args.join(' ')
    }

    private formatMessages(logObj: any, icon: string) {
      const dateText = this.getDateText(logObj)
      const coloredDateText = dim(dateText) ?? dateText
      return {
        plain: this.buildMessage(logObj, icon, dateText),
        colored: this.buildMessage(logObj, icon, coloredDateText),
      }
    }

    private buildMessage(logObj: any, icon: string, dateText: string) {
      const prefix = this.getPrefix()
      return `[${logObj.type.toUpperCase()}] ${icon}:${logObj.tag}${prefix ? ` ${prefix} ` : ' '}${dateText} ${this.toString(logObj)}`
    }

    private getDateText(logObj: any) {
      return logObj?.date instanceof Date ? logObj.date.toLocaleString() : new Date().toLocaleString()
    }

    getConsola(): ConsolaInstance {
      return this.consola
    }

    data<T>(message: string, data: T, logFn: ConsolaInstance['log'] = this.consola.log) {
      const ref = this.session.getVariableStore().add({ payload: data })
      const event = new OutputEvent('', 'console')
      ;(event as any).body.variablesReference = ref
      logFn(message)
      this.session.sendEvent(event)
    }
  }

  export function from(session: AbstractDebugSession) {
    return new VscodeDebuggerAdapterLoggerImpl(session)
  }
}
