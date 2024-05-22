import * as FS from 'node:fs/promises'
import { dirname } from 'node:path'
import * as process from 'node:process'

import { typeFlag } from 'type-flag'

import { stringify } from './stringify.js'
import { streamToString } from './utils.js'
import { NgxBaseError } from './errors.js'

const PROG_NAME = 'nginx-confjs'
const PROG_VERSION = '0.1.1'

const HELP = `\
Usage: ${PROG_NAME} [options] [<file>]

Convert given nginx configuration in JSON or YAML to the nginx configuration
syntax.

Arguments:
  <file>                 Path to JSON or YAML file with the nginx configuration.
                         If it's "-" or not provided, it's read from STDIN.

Options:
  -c --context <name>    Name of the top-level context (e.g. main, http, server)
                         in <file>. Defaults to "main".
  -f --format <format>   Format of the input file, either "json" or "yaml".
                         This is determined by the <file>
     --indent <num|str>  Indent each block with <num> spaces or with <str>.
                         Defaults to "\\t".
  -o --out <file>        Write the output to <file> instead of STDOUT.
  -V --version           Print program name & version and exit.
  -h --help              Print this message and exit.

Report issues at <https://github.com/jirutka/nginx-confjs/issues>.
`

async function readFile(filepath: string, format?: string): Promise<unknown> {
  const parse = format === 'yaml' || isYamlFile(filepath) ? parseYaml : parseJson
  try {
    const content =
      filepath === '/dev/stdin' ?
        await streamToString(process.stdin)
      : await FS.readFile(filepath, 'utf-8')
    return parse(content)
  } catch (err: any) {
    throw new NgxBaseError(`${filepath}: ${err.message}`, { cause: err })
  }
}

const isYamlFile = (filename: string) => filename.endsWith('.yml') || filename.endsWith('.yaml')

async function parseYaml(content: string): Promise<unknown> {
  const YAML = await import('yaml')
  return YAML.parse(content, { merge: true, prettyErrors: true })
}

async function parseJson(content: string): Promise<unknown> {
  return JSON.parse(content)
}

async function main(argv: string[]): Promise<void> {
  // prettier-ignore
  const { _: args, flags, unknownFlags } = typeFlag({
    context: {
      type: String,
      alias: 'c',
      default: 'main',
    },
    format: {
      type: String,
      alias: 'f',
    },
    indent: {
      type: String,
    },
    out: {
      type: String,
      alias: 'o',
    },
    version: {
      type: Boolean,
      alias: 'V',
    },
    help: {
      type: Boolean,
      alias: 'h',
    },
  }, argv)

  if (flags.help) {
    console.log(HELP)
    return
  }

  if (flags.version) {
    console.log(`${PROG_NAME} ${PROG_VERSION}`)
    return
  }

  if (Object.keys(unknownFlags).length > 0) {
    const unknowns = Object.keys(unknownFlags).map(flag =>
      flag.length > 1 ? `--${flag}` : `-${flag}`,
    )
    throw new NgxBaseError(`Unknown options: ${unknowns.join(', ')} (see --help)`)
  }

  let filepath = args[0]
  if (!filepath || filepath === '-') {
    filepath = '/dev/stdin'
  }

  const indentation = /^\d+$/.test(flags.indent ?? '') ? Number(flags.indent) : flags.indent

  const yaml = await readFile(filepath)
  const result = stringify(flags.context as any, yaml as any, { indentation })

  if (flags.out) {
    await FS.mkdir(dirname(flags.out), { recursive: true })
    await FS.writeFile(flags.out, result, 'utf-8')
  } else {
    console.log(result)
  }
}

main(process.argv.slice(2)).catch(err => {
  if (err instanceof NgxBaseError) {
    console.error(`${PROG_NAME}: ${err.message}`)
    if (process.env.DEBUG) {
      console.debug(err.stack)
    }
    process.exit(10)
  } else {
    console.error(err)
    process.exit(1)
  }
})
