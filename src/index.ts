// NOTE: ReadonlyArray doesn't work with `Array.isArray()`.
export type NgxValue =
  | string
  | number
  | boolean
  | Array<string | number> // repeated directive
  | { [P in string]: string | number | boolean } // repeated directive as an object
  | null // directive without a value

export type NgxContext = { [P in string]?: NgxValue | NgxBlockWithParams | NgxBlockWithoutParams }

export type NgxBlockWithParams = Record<string, NgxContext>

export type NgxBlockWithoutParams = NgxContext | NgxContext[]

export type { ContextName } from './contextName.js'
export * from './directiveTypes.js'
export * from './stringify.js'
export * from './transform.js'
export * from './traverse.js'
