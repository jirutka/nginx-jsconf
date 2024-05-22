import assert from 'node:assert/strict'
import test from 'node:test'

import { transform } from '../lib/index.js'

const input = {
  server: [
    {
      listen: '443 http2 ssl',
      server_name: 'example.org',
      include: 'auth-server',
      location: {
        '/': {
          include: 'auth-access',
          proxy_pass: 'http://1.2.3.4',
          proxy_set_header: {
            Host: '$http_host',
          },
          proxy_buffering: false,
        },
        '~ \\.(?:css|js)$': {
          add_header: {
            'Cache-Control': '"max-age=31556952, public"',
          },
        },
      },
    },
  ],
}

test('transform', () => {
  const expected = {
    server: [
      {
        listen: '443 http2 ssl',
        server_name: 'example.org',
        include: ['/etc/nginx/incl/auth-server.conf'],
        location: {
          '/': {
            include: 'auth-access',
            proxy_pass: 'http://1.2.3.4',
            proxy_set_header: {
              Host: '$http_host',
              'X-Forwarded-For': '$proxy_add_x_forwarded_for',
              'X-Forwarded-Host': '$host',
            },
            proxy_buffering: false,
          },
          '~ \\.(?:css|js)$': {
            add_header: {
              'Cache-Control': '"max-age=31556952, public"',
            },
          },
        },
      },
    ],
  }

  const addProxyHeadersTransformer = {
    name: ['server', 'location', 'if'],
    block: true,
    if: context => 'proxy_pass' in context,
    transform: context => ({
      ...context,
      proxy_set_header: {
        ...context.proxy_set_header,
        'X-Forwarded-For': '$proxy_add_x_forwarded_for',
        'X-Forwarded-Host': '$host',
      },
    }),
  }

  const adjustIncludePathTransformer = {
    name: 'include',
    context: ['server'],
    block: false,
    transform: value => {
      const values = Array.isArray(value) ? value : [value]
      return values.map(name => `/etc/nginx/incl/${name}.conf`)
    },
  }

  const actual = transform('http', input, [
    addProxyHeadersTransformer,
    adjustIncludePathTransformer,
  ])

  assert.deepEqual(actual, expected)
})
