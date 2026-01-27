# ArkTS Debugger

> 🚧 Working in progress...

Debugger for OpenHarmony/HarmonyOS applications.

![ArkTS Debugger](./assets/usage_small.gif)

## How to start development

Install dependencies and open the project in VSCode or VSCode like editor (like Cursor, etc.).

```bash
pnpm install
```

Switch to the `vscode's debug panel` and click the `Launch` button to start an extension development host `vscode` instance, it will be open the `${workspaceFolder}/test/app` folder to start the development.

Now, please make sure the `hdc` and `hvigor` command is available in your OS, and using `hdc` to connect your device or emulator to your computer. [What is hdc?](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/hdc)

Then, using `hvigor` to build the application:

```bash
# This command is copied from DevEco Studio
hvigor --mode module -p module=entry@default -p product=default -p requiredDeviceType=phone assembleHap --analyze=normal --parallel --incremental --daemon
```

And then install it:

```bash
hdc shell aa force-stop cc.naily.myapplication
hdc shell mkdir data/local/tmp/b0f5dd86280744aeaffadf73c0a9afa1
hdc file send /debugger/test/app/entry/build/default/outputs/default/entry-default-unsigned.hap "data/local/tmp/b0f5dd86280744aeaffadf73c0a9afa1"
hdc shell bm install -p data/local/tmp/b0f5dd86280744aeaffadf73c0a9afa1
hdc shell rm -rf data/local/tmp/b0f5dd86280744aeaffadf73c0a9afa1
```

Switch to vscode extension development host, click the `Launch` button **in vscode development host** (**not your workspace!**), Enjoy it!

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
