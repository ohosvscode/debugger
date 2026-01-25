const vscode = require('vscode')
const { VscodeDebuggerAdapter } = require('../../../dist/vscode.cjs')

/**
 * @param {import('vscode').ExtensionContext} context
 */
function activate(context) {
  context.subscriptions.push(
    vscode.debug.registerDebugAdapterDescriptorFactory('arkts-debugger', {
      createDebugAdapterDescriptor() {
        return new vscode.DebugAdapterInlineImplementation(new VscodeDebuggerAdapter())
      },
    }),
  )
}

module.exports = { activate }
