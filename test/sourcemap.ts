import { fileURLToPath } from 'node:url'
import { SourceMapConsumer } from 'source-map'
import mockSourceMaps from './sourceMaps.json'

let __dirname = globalThis.__dirname
if (!__dirname) __dirname = fileURLToPath(new URL('.', import.meta.url))

async function main() {
  for (const [key, mockSourceMap] of Object.entries(mockSourceMaps)) {
    const consumer = await new SourceMapConsumer(mockSourceMap)
    console.log(key)
    console.log(consumer)
    consumer.destroy()
  }
}

main()
