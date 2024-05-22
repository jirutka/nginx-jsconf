import { NgxInputError } from './errors.js'
import { isPlainObj } from './utils.js'

export type DirectiveType = 'BLOCK_WITHOUT_PARAM' | 'BLOCK_WITH_PARAM' | 'SIMPLE' | 'NULLARY'

export type DirectiveTypeResolver<TState = any> = (
  contextPath: readonly string[],
  value: any,
  state: TState,
) => DirectiveType

/**
 * List of nginx's built-in block (context) directives with no parameter (e.g.
 * `main/http`, `main/http/server`).
 */
export const BUILTIN_BLOCKS_WITHOUT_PARAM = new Set<string>([
  'main/events',
  'main/http',
  'main/http/server',
  'main/mail',
  'main/mail/server',
  'main/stream',
  'main/stream/server',
])

export function createDirectiveTypeResolver(
  blocksWithoutParam = BUILTIN_BLOCKS_WITHOUT_PARAM,
): DirectiveTypeResolver {
  const isBlockWithoutParam = (path: readonly string[], value: any) =>
    blocksWithoutParam.has(path.join('/')) || (!!path.at(-1)?.endsWith('{}') && isPlainObj(value))

  return (path, value) => {
    if (value === null) {
      return 'NULLARY'
    }
    if (Array.isArray(value)) {
      if (value.every(val => isBlockWithoutParam(path, val))) {
        return 'BLOCK_WITHOUT_PARAM'
      } else if (value.every(isSimple)) {
        return 'SIMPLE'
      }
    }
    if (isPlainObj(value)) {
      if (isBlockWithoutParam(path, value)) {
        return 'BLOCK_WITHOUT_PARAM'
      } else if (Object.values(value).every(isPlainObj)) {
        return 'BLOCK_WITH_PARAM'
      } else if (Object.values(value).every(isSimple)) {
        return 'SIMPLE'
      }
    }
    if (isSimple(value)) {
      return 'SIMPLE'
    }
    throw new NgxInputError(`Invalid value in ${path.join('/')}`, value)
  }
}

const isSimple = (value: any) =>
  typeof value === 'string' ||
  typeof value === 'number' ||
  typeof value === 'boolean' ||
  typeof value === 'bigint'
