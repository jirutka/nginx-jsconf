import { type ContextName, contextNameToPath } from './contextName.js'
import {
  BUILTIN_BLOCKS_WITHOUT_PARAM,
  createDirectiveTypeResolver,
  type DirectiveTypeResolver,
} from './directiveTypes.js'
import { type NgxContext, type NgxValue } from './index.js'
import { arrify, isPlainObj, isString, splitAt } from './utils.js'

/** Skip traversal of the current node's children. */
export const SKIP = Symbol('SKIP')

export type Action = typeof SKIP

// NOTE: ReadonlyArray doesn't work with `Array.isArray()`.
export type SimpleDirectiveValues =
  | Array<string | number | boolean>
  | Record<string, string | number | boolean>
  | null

export interface Visitor<TState = {}> {
  /**
   * Visit a simple (not a block) directive.
   *
   * `values` is normalized, so it's always an array, object or `null` (if the
   * directive has no value).
   * **Do not mutate** `values`!
   */
  visitSimple?: (
    name: string,
    values: SimpleDirectiveValues,
    context: string,
    state: TState,
  ) => void
  /** Visit a block directive. */
  visitBlock?: (
    name: string,
    blocks: readonly NgxContext[] | Record<string, NgxContext>,
    context: string,
    state: TState,
  ) => Action | void
  /** Visit a context before diving into the directives it contains. */
  enterContext?: (
    name: string,
    param: string | number,
    contextObj: NgxContext,
    parentContext: string,
    state: TState,
  ) => Action | void
  /** Visit a context after visiting the directives it contains. */
  leaveContext?: (
    name: string,
    param: string | number,
    contextObj: NgxContext,
    parentContext: string,
    state: TState,
  ) => void
}

export interface TraverseOptions<TState = {}> {
  directiveTypeResolver?: DirectiveTypeResolver<TState>
}

export function traverse<TState = {}>(
  context: ContextName | readonly string[] = 'main',
  input: NgxContext,
  visitor: Visitor<TState>,
  state?: TState | null,
  opts: TraverseOptions<TState> = {},
): void {
  state ??= {} as TState
  const resolveDirectiveType =
    opts.directiveTypeResolver ?? createDirectiveTypeResolver(BUILTIN_BLOCKS_WITHOUT_PARAM)

  const visit = (
    name: string,
    value: NgxContext | NgxContext[] | NgxValue,
    path: readonly string[],
  ): void => {
    const parentContext = path.at(-1) ?? ''
    switch (resolveDirectiveType([...path, name], value, state)) {
      case 'NULLARY': {
        visitor.visitSimple?.(name, null, parentContext, state)
        break
      }
      case 'SIMPLE': {
        if (visitor.visitSimple) {
          const values = (isPlainObj(value) ? value : arrify(value)) as SimpleDirectiveValues
          visitor.visitSimple(name, values, parentContext, state)
        }
        break
      }
      case 'BLOCK_WITHOUT_PARAM': {
        const contexts = arrify(value) as NgxContext[]

        if (visitor.visitBlock?.(name, contexts, parentContext, state) !== SKIP) {
          for (const [idx, context] of contexts.entries()) {
            visitContext(name, idx, context, path)
          }
        }
        break
      }
      case 'BLOCK_WITH_PARAM': {
        const contexts = value as Record<string, NgxContext>

        if (visitor.visitBlock?.(name, contexts, parentContext, state) !== SKIP) {
          for (const param of Object.keys(contexts)) {
            visitContext(name, param, contexts[param], path)
          }
        }
        break
      }
    }
  }

  const visitContext = (
    name: string,
    param: string | number,
    contextObj: NgxContext | undefined,
    path: readonly string[],
  ): void => {
    if (contextObj === undefined) {
      return
    }
    const parentContext = path.at(-1) ?? ''

    if (visitor.enterContext?.(name, param, contextObj, parentContext, state) === SKIP) {
      return
    }
    const nestedPath = [...path, name]

    for (const name of Object.keys(contextObj)) {
      const value = contextObj[name]
      if (value !== undefined) {
        visit(name, value, nestedPath)
      }
    }
    visitor.leaveContext?.(name, param, contextObj, parentContext, state)
  }

  const contextPath = isString(context) ? contextNameToPath(context) : context
  const [path, [name]] = splitAt(contextPath, -1)

  return visitContext(name, 0, input, path)
}
