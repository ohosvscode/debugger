import { JsonException } from './errors/json-exception'

export async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      clearTimeout(timer)
      resolve()
    }, ms)
  })
}

export namespace JSONPromiseify {
  export async function parse<T = unknown>(json: string): Promise<T> {
    try {
      return JSON.parse(json)
    }
    catch (error) {
      throw new JsonException(`Failed to parse JSON: ${json}`, JsonException.Type.PARSE_ERROR, error)
    }
  }

  export async function stringify<T = unknown>(value: T): Promise<string> {
    try {
      return JSON.stringify(value)
    }
    catch (error) {
      throw new JsonException(`Failed to stringify value: ${value}`, JsonException.Type.STRINGIFY_ERROR, error)
    }
  }
}
