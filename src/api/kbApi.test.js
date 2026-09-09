import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveKbApiBase } from './apiBase.js'

test('uses the configured KB API base when provided', () => {
  assert.equal(resolveKbApiBase('https://kb.example.test/api'), 'https://kb.example.test/api')
})

test('defaults to the same-origin Nginx KB API path', () => {
  assert.equal(resolveKbApiBase(''), '/kb/api')
  assert.equal(resolveKbApiBase(undefined), '/kb/api')
})
