import assert from 'node:assert/strict'
import * as FS from 'node:fs/promises'
import test from 'node:test'

import * as YAML from 'yaml'

import { stringify } from '../lib/index.js'

const fixturesDir = './tests/fixtures'

// prettier-ignore
;[// name             , context
  ['main-small'       , 'main'  ],
  ['http-server-small', 'server'],
  ['main-example-1'   , 'main'  ],
  ['main-example-2'   , 'main'  ],
].forEach(([name, context]) => {
  test(`stringify ${name}.yml`, async () => {
    const input = await readYaml(`${fixturesDir}/${name}.yml`)
    const expected = await FS.readFile(`${fixturesDir}/${name}.conf`, 'utf8')

    const actual = stringify(context, input)

    assert.equal(actual.trim(), expected.trim())
  })
})

async function readYaml(filepath) {
  const content = await FS.readFile(filepath, 'utf-8')
  return YAML.parse(content)
}
