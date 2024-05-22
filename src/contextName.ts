export type ContextName =
  | 'events'
  | 'http'
  | 'location' // http
  | 'mail'
  | 'main'
  | 'server' // http mail stream
  | 'stream'
  | 'unknown'

/** @internal */
export function contextNameToPath(contextName: string): ContextName[] {
  switch (contextName) {
    case 'main':
      return ['main']
    case 'server':
      return ['main', 'unknown', 'server']
    case 'location':
      return ['main', 'http', 'location']
    case 'http':
    case 'mail':
    case 'stream':
      return ['main', contextName]
    default:
      return ['unknown']
  }
}
