import { type ContextName, contextNameToPath } from './contextName.js'
import {
  BUILTIN_BLOCKS_WITHOUT_PARAM,
  createDirectiveTypeResolver,
  type DirectiveTypeResolver,
} from './directiveTypes.js'
import { type NgxContext, type NgxValue } from './index.js'
import { arrify, groupBy, isString, splitAt } from './utils.js'

/** @see {@link transform} */
export type Transformer<TState = {}> = SimpleTransformer<TState> | BlockTransformer<TState>

interface BaseTransformer {
  /** Specify which directive names this transformation will be applied to. */
  name?: string | readonly string[]
  /** A list of context names to which this transformation is applied.*/
  context?: readonly string[]
  /** Apply on block directives (`true`), or simple directives (`false`)? */
  block?: boolean
}

export interface SimpleTransformer<TState = {}> extends BaseTransformer {
  block: false
  /**
   * If defined, this function is called to determine whether to call
   * `transform`. The arguments are the same as in `transform`.
   */
  if?: (values: NgxValue, state: TState, name: string, context: string) => boolean
  /**
   * Transforms the `values` of a simple directive `name`. It's called once per
   * directive with `name` within the given `context`. If the directive is
   * defined multiple times, `values` will contain an array or object
   * (key-value) of all values. If the directive has no value, `values` is
   * `null`.
   *
   * **Do not mutate** the given `values`, return a modified copy instead. You
   * can return `undefined` to remove the directive from the config.
   */
  transform: (values: NgxValue, state: TState, name: string, context: string) => NgxValue
}

export interface BlockTransformer<TState = {}> extends BaseTransformer {
  block: true
  /**
   * If defined, this function is called to determine whether to call
   * `transform`. The arguments are the same as in `transform`.
   */
  if?: (
    value: NgxContext,
    state: TState,
    name: string,
    param: string | number,
    parentContext: string,
  ) => boolean
  /** Run this transformer in `pre`-order or `post`-order? Default is `pre`. */
  order?: 'pre' | 'post'
  /**
   * Transforms the `value` (context) of a block directive `name`. Unlike the
   * simple directive transformer, this function is called once for each
   * instance of the directive within the given `parentContext`. If the
   * directive has no parameter, `param` is a `number` (0-based index of the
   * directive within the context).
   *
   * **Do not mutate** the given `values`, return a modified copy instead. You
   * can return `undefined` to remove the directive from the config.
   */
  transform: (
    value: NgxContext,
    state: TState,
    name: string,
    param: string | number,
    parentContext: string,
  ) => NgxContext
}

export interface TransformOptions<TState = {}> {
  directiveTypeResolver?: DirectiveTypeResolver<TState>
}

/**
 * Transforms the `input` configuration using the given `transformers` and
 * returns its transformed copy.
 *
 * This function does not perform a deep clone - it clones objects only when
 * one of the transformers return a different value.
 *
 * @param context The name or path of the top-level context of the `input` (e.g.
 *   `main`, `http`, `main/http`).
 * @param input The configuration to transform.
 * @param transformers A list of transformers to apply on `input`.
 * @param state Optional object to pass around the transformers.
 * @param opts Options.
 * @returns A transformed copy of `input`.
 */
export function transform<TState = {}>(
  context: ContextName | readonly string[] = 'main',
  input: NgxContext,
  transformers: readonly Transformer<TState>[],
  state?: TState | null,
  opts: TransformOptions<TState> = {},
): NgxContext {
  state ??= {} as TState
  const resolveDirectiveType =
    opts.directiveTypeResolver ?? createDirectiveTypeResolver(BUILTIN_BLOCKS_WITHOUT_PARAM)

  const transformersByName = groupBy(transformers, t =>
    arrify(t.name ?? '').map(name => `${t.block ? '+' : '-'}${name}`),
  )

  function* eachTransformer<B extends boolean>(
    directiveName: string,
    context: string,
    isBlock: B,
  ): Generator<B extends true ? BlockTransformer<TState> : SimpleTransformer<TState>> {
    const prefix = isBlock ? '+' : '-'
    for (const trans of transformersByName.get(`${prefix}${directiveName}`) ?? []) {
      if (trans.context?.includes(context) !== false) {
        yield trans as any
      }
    }
    // Transformers without `name`.
    for (const trans of transformersByName.get(prefix) ?? []) {
      if (trans.context?.includes(context) !== false) {
        yield trans as any
      }
    }
  }

  const visit = (
    name: string,
    value: NgxContext | NgxContext[] | NgxValue,
    path: readonly string[],
  ) => {
    switch (resolveDirectiveType([...path, name], value, state)) {
      case 'NULLARY':
      case 'SIMPLE': {
        const context = path.at(-1) ?? ''
        for (const trans of eachTransformer(name, context, false)) {
          if (trans.if?.(value as NgxValue, state, name, context) !== false) {
            value = trans.transform(value as NgxValue, state, name, context)
          }
          if (value === undefined) {
            break
          }
        }
        return value
      }
      case 'BLOCK_WITHOUT_PARAM': {
        const contexts = arrify(value) as NgxContext[]

        return contexts.reduce((acc, context, idx) => {
          const result = visitContext(name, idx, context, path)
          if (result !== undefined) {
            acc.push(result)
          }
          return acc
        }, [] as NgxContext[])
      }
      case 'BLOCK_WITH_PARAM': {
        let contexts = value as Record<string, NgxContext>

        let cloned = false
        for (const param of Object.keys(contexts)) {
          const oldContext = contexts[param]
          const newContext = visitContext(name, param, oldContext, path)
          if (newContext === oldContext) {
            continue
          }
          if (!cloned) {
            contexts = { ...contexts }
            cloned = true
          }
          if (newContext === undefined) {
            delete contexts[param]
          } else {
            contexts[param] = newContext
          }
        }
        return contexts
      }
    }
  }

  const visitContext = (
    name: string,
    param: string | number,
    contextObj: NgxContext | undefined,
    path: readonly string[],
  ): NgxContext | undefined => {
    if (!contextObj) {
      return
    }
    const parentContext = path.at(-1) ?? ''

    for (const trans of eachTransformer(name, parentContext, true)) {
      if (
        trans.order !== 'post' &&
        trans.if?.(contextObj, state, name, param, parentContext) !== false
      ) {
        contextObj = trans.transform(contextObj, state, name, param, parentContext)
      }
      if (!contextObj) {
        return
      }
    }

    const nestedPath = [...path, name]

    let cloned = false
    for (const name of Object.keys(contextObj)) {
      const oldValue = contextObj[name]
      if (oldValue === undefined) {
        continue
      }
      const newValue = visit(name, oldValue, nestedPath)
      if (newValue === oldValue) {
        continue
      }
      if (!cloned) {
        contextObj = { ...contextObj }
        cloned = true
      }
      if (newValue === undefined) {
        delete contextObj[name]
      } else {
        contextObj[name] = newValue as any
      }
    }

    for (const trans of eachTransformer(name, parentContext, true)) {
      if (
        trans.order === 'post' &&
        trans.if?.(contextObj, state, name, param, parentContext) !== false
      ) {
        contextObj = trans.transform(contextObj, state, name, param, parentContext)
      }
      if (!contextObj) {
        return
      }
    }
    return contextObj
  }

  const contextPath = isString(context) ? contextNameToPath(context) : context
  const [path, [name]] = splitAt(contextPath, -1)

  return visitContext(name, 0, input, path) as NgxContext // FIXME
}
