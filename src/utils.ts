/** @internal */
export function arrify<T>(value: T | readonly T[] | undefined | null): T[] {
  return (
    value == null ? []
    : Array.isArray(value) ? value
    : [value]) as T[]
}

/** @internal */
export function groupBy<T>(
  list: readonly T[],
  groupFn: (x: T) => string | string[],
): Map<string, T[]> {
  return list.reduce((groups, value) => {
    for (const key of arrify(groupFn(value))) {
      let group = groups.get(key)
      if (!group) {
        groups.set(key, (group = []))
      }
      group.push(value)
    }
    return groups
  }, new Map<string, T[]>())
}

/** @internal */
export function isPlainObj(input: any): input is Record<PropertyKey, any> {
  return (
    input != null &&
    typeof input === 'object' &&
    Object.prototype.toString.call(input).slice(8, -1) === 'Object'
  )
}

/** @internal */
export function isString(input: any): input is string {
  return typeof input === 'string'
}

/** @internal */
export function splitAt<T>(input: readonly T[], index: number): [T[], T[]] {
  return [input.slice(0, index), input.slice(index)]
}

/** @internal */
export async function streamToString(stream: NodeJS.ReadStream): Promise<string> {
  const chunks = []
  for await (const chunk of stream) {
    chunks.push(chunk)
  }
  return Buffer.concat(chunks).toString('utf8')
}

/** @internal */
export function trimSuffix(str: string, suffix: string): string {
  return str.endsWith(suffix) ? str.slice(0, -suffix.length) : str
}
