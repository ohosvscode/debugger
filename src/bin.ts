import { DebugSession } from '@vscode/debugadapter'
import { VscodeDebuggerAdapter } from './vscode'

DebugSession.run(VscodeDebuggerAdapter)
