import type { Adapter } from '../adapter'
import type { LaunchRequest } from '../vscode'
import type { VscodeDebuggerAdapter } from './debugger-adapter'
import path from 'node:path'

export namespace SetBreakpoints {
  export function buildMultiLocation(vscodeDebuggerAdapter: VscodeDebuggerAdapter): Adapter.MultiLocation | Error {
    const sourceMaps = vscodeDebuggerAdapter.readSourceMap()
    if (sourceMaps instanceof Error) return sourceMaps
    const locations: Adapter.MultiLocation = {}

    for (const [filePath, breakpoints] of vscodeDebuggerAdapter.getBreakpointStore().entries()) {
      const relativeFilePath = path.relative(vscodeDebuggerAdapter.getProjectRoot(), filePath)
      const sourceMap = sourceMaps.find(sourceMap => sourceMap.getSources().includes(relativeFilePath))
      if (!sourceMap) continue

      for (const breakpoint of breakpoints) {
        const transformedLocation = sourceMap.getSourceMapReader().generatedPositionFor({
          line: breakpoint.line,
          column: breakpoint.column ?? 0,
          source: relativeFilePath,
          bias: -1, // 寻找最接近的生成位置
        })

        if (!locations[sourceMap.getCDPSource()]) {
          locations[sourceMap.getCDPSource()] = [
            {
              lineNumber: transformedLocation.line ?? 0,
              columnNumber: transformedLocation.column ?? 0,
            },
          ]
        }
        else {
          locations[sourceMap.getCDPSource()].push({
            lineNumber: transformedLocation.line ?? 0,
            columnNumber: transformedLocation.column ?? 0,
          })
        }
      }
    }

    return locations
  }

  export function buildUrlLocation(vscodeDebuggerAdapter: VscodeDebuggerAdapter): Array<Adapter.UrlLocation> & { getSourceMaps(): LaunchRequest.CDPConnection.SourceMap[] } | Error {
    const sourceMaps = vscodeDebuggerAdapter.readSourceMap()
    if (sourceMaps instanceof Error) return sourceMaps
    const locations: Array<Adapter.UrlLocation> & { getSourceMaps(): LaunchRequest.CDPConnection.SourceMap[] } = [] as any

    for (const [filePath, breakpoints] of vscodeDebuggerAdapter.getBreakpointStore().entries()) {
      const relativeFilePath = path.relative(vscodeDebuggerAdapter.getProjectRoot(), filePath)
      const sourceMap = sourceMaps.find(sourceMap => sourceMap.getSources().includes(relativeFilePath))
      if (!sourceMap) continue

      for (const breakpoint of breakpoints) {
        const transformedLocation = sourceMap.getSourceMapReader().generatedPositionFor({
          line: breakpoint.line,
          column: breakpoint.column ?? 0,
          source: relativeFilePath,
          bias: -1, // 寻找最接近的生成位置
        })

        locations.push({
          url: sourceMap.getCDPSource(),
          lineNumber: transformedLocation.line ?? 0,
          columnNumber: transformedLocation.column ?? 0,
        })
      }
    }

    locations.getSourceMaps = () => sourceMaps

    return locations
  }

  export function getCDPSource(vscodeDebuggerAdapter: VscodeDebuggerAdapter, filePath: string, sourceMaps: LaunchRequest.CDPConnection.SourceMap[]): string | Error {
    const relativeFilePath = path.relative(vscodeDebuggerAdapter.getProjectRoot(), filePath)
    const sourceMap = sourceMaps.find(sourceMap => sourceMap.getSources().includes(relativeFilePath))
    if (!sourceMap) return new Error('Source map not found')
    return sourceMap.getCDPSource()
  }
}
