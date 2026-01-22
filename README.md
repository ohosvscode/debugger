# ArkTS Debugger

> 🚧 Working in progress...

Debugger for OpenHarmony/HarmonyOS applications.

![ArkTS Debugger](./assets/usage_small.gif)

## Usage

```typescript
import { createConnection, createWsAdapter } from '@arkts/debugger'

async function main() {
  const connection = await createConnection({
    adapter: createWsAdapter(), // Using `ws` adapter to connect to the debugger.
    identifier: 'com.example.app', // The identifier of the OpenHarmony/HarmonyOS application.
  })

  const debuggerAdapter = await connection.getDebuggerAdapter()
  const runtimeAdapter = await connection.getRuntimeAdapter()

  // Enable runtime
  await runtimeAdapter.enable({ params: { options: ['enableLaunchAccelerate'], maxScriptsCacheSize: 1.0e7 } })
  // Enable debugger
  await debuggerAdapter.enable({ params: { maxScriptsCacheSize: 1.0e7, options: ['enableLaunchAccelerate'] } })
  // Save all possible breakpoints
  await debuggerAdapter.saveAllPossibleBreakpoints({ params: { locations: {} } })
  // Run if waiting for debugger
  await runtimeAdapter.runIfWaitingForDebugger({ params: {} })

  connection.push(
    connection.onNotification(async (notification) => {
      if (!Adapter.OptionalNotification.is(notification)) return
      if (notification.method !== 'Debugger.scriptParsed') return
      console.log(`Debugger.scriptParsed: ${notification.params.scriptId}`)
    })
  )
}

main()
