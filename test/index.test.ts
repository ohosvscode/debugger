import { createConnection } from '../src'
import { createWsAdapter } from '../src/ws'

describe('connection', (it) => {
  it.sequential('should create a connection', async () => {
    const connection = await createConnection({
      adapter: createWsAdapter(),
      identifier: 'cc.naily.myapplication',
    })

    expect(connection).toBeDefined()
  })
})
