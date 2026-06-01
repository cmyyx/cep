interface CepDebugApi {
  getLogs(): Array<{ l: string; t: number; a: string[] }>
  clear(): void
  getEnv(): Record<string, string>
  silentLog(level: 'warn' | 'debug' | 'error' | 'log', args: unknown[]): void
  openPanel(): void
  togglePanel(): void
  _openPanel(): void
  _togglePanel(): void
  _onLog: (() => void) | null
  _injectedCount(): number
  version?: {
    version: string
    commit: string
    count: string
    commitTime: string
    buildTime: string
  }
}

interface Window {
  __cep_debug__?: CepDebugApi
}
