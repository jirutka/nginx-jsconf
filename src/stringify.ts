import {
  BUILTIN_BLOCKS_WITHOUT_PARAM,
  type DirectiveTypeResolver,
  createDirectiveTypeResolver,
} from './directiveTypes.js'
import { type ContextName, type NgxContext } from './index.js'
import { type Visitor, traverse } from './traverse.js'
import { trimSuffix } from './utils.js'

export interface NgxStringifyOptions {
  /**
   * A set of paths of block directives with no parameter (e.g. `main/http`,
   * `main/http/server`). Default is {@link BUILTIN_BLOCKS_WITHOUT_PARAM}.
   * This option is ignored if `directiveTypeResolver` is provided.
   */
  blocksWithoutParam?: Set<string>

  directiveTypeResolver?: DirectiveTypeResolver
  /**
   * Indent each block with _number_ of spaces or with given _string_. Default
   * is `\t`.
   */
  indentation?: string | number
  /**
   * Provide a custom function to stringify the given `value` for nginx
   * configuration.
   */
  stringifyValue?: (value: string | boolean | number | bigint, name: string) => string
}

/**
 * Converts the `input` nginx configuration to the nginx format.
 *
 * @param context The name or path of the top-level context of the `input` (e.g.
 *   `main`, `http`, `main/http`).
 * @param input The configuration to stringify.
 * @param opts
 */
export function stringify(
  context: ContextName | readonly string[],
  input: NgxContext,
  opts: NgxStringifyOptions = {},
): string {
  const indent =
    opts.indentation == null ? '\t'
    : typeof opts.indentation === 'number' ? ' '.repeat(opts.indentation)
    : opts.indentation

  const directiveTypeResolver =
    opts.directiveTypeResolver ??
    createDirectiveTypeResolver(opts.blocksWithoutParam ?? BUILTIN_BLOCKS_WITHOUT_PARAM)

  const stringifyValue = opts.stringifyValue ?? defaultStringifyValue

  const buffer: string[] = []
  let indentLevel = -1

  const writeln = (line: string) => {
    buffer.push((line ? indent.repeat(indentLevel) : '') + line)
  }

  const visitors: Visitor = {
    visitSimple(name, values) {
      if (values == null) {
        writeln(`${name};`)
      } else if (Array.isArray(values)) {
        if (name === '__raw') {
          for (const line of values.flatMap(val => String(val).split('\n'))) {
            writeln(line)
          }
        } else {
          writeln('')
          for (const val of values) {
            writeln(`${name} ${stringifyValue(val, name)};`)
          }
        }
      } else {
        writeln('')
        for (const [key, val] of Object.entries(values)) {
          writeln(`${name} ${stringifyValue(key, name)} ${stringifyValue(val, name)};`)
        }
      }
    },
    enterContext: (name, param) => {
      if (indentLevel >= 0) {
        writeln('')
        writeln(
          typeof param === 'number' ?
            `${trimSuffix(name, '{}')} {`
          : `${name} ${stringifyValue(param, name)} {`,
        )
      }
      indentLevel++
    },
    leaveContext: () => {
      if (--indentLevel >= 0) {
        writeln('}')
      }
    },
  }

  traverse(context, input, visitors, null, { directiveTypeResolver })

  return buffer.join('\n')
}

function defaultStringifyValue(value: string | boolean | number | bigint): string {
  const type = typeof value

  if (value == null) {
    return ''
  } else if (type === 'boolean') {
    return value ? 'on' : 'off'
  } else if (type === 'string' || type === 'number' || type === 'bigint') {
    return String(value).trim()
  } else {
    throw new TypeError(`Expected a scalar value, null or undefined, but got: ${typeof value}`)
  }
}
