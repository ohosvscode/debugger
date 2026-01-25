import type { VscodeDebuggerAdapter } from './debugger-adapter'
import { Adapter } from '../adapter'

export async function disposeConnection(vscodeDebuggerAdapter: VscodeDebuggerAdapter): Promise<void> {
  if (!vscodeDebuggerAdapter.getConnection()) return vscodeDebuggerAdapter.getLogger().getConsola().info('The connection is not found.')
  await disableRuntimeNamespace(vscodeDebuggerAdapter)
  await disableDebuggerNamespace(vscodeDebuggerAdapter)
  vscodeDebuggerAdapter.getLogger().getConsola().info('Disposing connection...')
  await vscodeDebuggerAdapter.getConnection()?.dispose()
  vscodeDebuggerAdapter.getLogger().getConsola().info('Connection disposed.')
}

async function disableRuntimeNamespace(vscodeDebuggerAdapter: VscodeDebuggerAdapter): Promise<void> {
  const runtimeAdapter = await vscodeDebuggerAdapter.getConnection()?.getRuntimeAdapter()
  if (!runtimeAdapter) return vscodeDebuggerAdapter.getLogger().getConsola().info('The runtime adapter is not found.')
  vscodeDebuggerAdapter.getLogger().getConsola().info('Disabling runtime namespace...')
  const result = await runtimeAdapter.disable({ params: {} })
  if (!Adapter.Response.is(result)) return vscodeDebuggerAdapter.getLogger().data('Failed to disable runtime namespace:', result)
  vscodeDebuggerAdapter.getLogger().data('Runtime namespace disabled.', result)
}

async function disableDebuggerNamespace(vscodeDebuggerAdapter: VscodeDebuggerAdapter): Promise<void> {
  const debuggerAdapter = await vscodeDebuggerAdapter.getConnection()?.getDebuggerAdapter()
  if (!debuggerAdapter) return vscodeDebuggerAdapter.getLogger().getConsola().info('The debugger adapter is not found.')
  vscodeDebuggerAdapter.getLogger().getConsola().info('Disabling debugger namespace...')
  const result = await debuggerAdapter.disable({ params: {} })
  if (!Adapter.Response.is(result)) return vscodeDebuggerAdapter.getLogger().data('Failed to disable debugger namespace:', result)
  vscodeDebuggerAdapter.getLogger().data('Debugger namespace disabled.', result)
}
