import { expect, it } from 'vitest'
import { replaceBuffers, reviveBuffers } from './reviveBuffers'

it('leaves primitives as-is', () => {
	const result = reviveBuffers('foobar')
	expect(result).toEqual('foobar')
})

it('converts top-level buffer', () => {
	const result = reviveBuffers({ type: 'Buffer', data: [1] })
	expect(result).toEqual(Buffer.from([1]))
})

it('converts deep buffers', () => {
	const result = reviveBuffers({
		deeply: {
			nested: {
				buffer: { type: 'Buffer', data: [1] },
			},
		},
	})
	expect(result.deeply.nested.buffer).toEqual(Buffer.from([1]))
})

it('converts buffers in arrays', () => {
	const result = reviveBuffers([
		{ type: 'Buffer', data: [1] },
		{ type: 'Buffer', data: [2] },
		{ type: 'Buffer', data: [3] },
	])
	expect(result).toEqual([Buffer.from([1]), Buffer.from([2]), Buffer.from([3])])
})

it('converts top-level base64 buffer', () => {
	const result = reviveBuffers({ type: 'Buffer', data: 'aGVsbG8=' })
	expect(result).toEqual(Buffer.from('hello'))
})

it('converts deep base64 buffers', () => {
	const result = reviveBuffers({
		deeply: { nested: { buffer: { type: 'Buffer', data: 'aGVsbG8=' } } },
	})
	expect(result.deeply.nested.buffer).toEqual(Buffer.from('hello'))
})

it('replaces buffers with base64 instead of number arrays', () => {
	const json = JSON.stringify({ body: Buffer.from('hello') }, replaceBuffers)
	expect(json).toBe('{"body":{"type":"Buffer","data":"aGVsbG8="}}')
})

it('round-trips buffers through replaceBuffers and reviveBuffers', () => {
	const original = {
		kind: 'APP_ROUTE',
		status: 200,
		body: Buffer.from([0, 1, 2, 253, 254, 255]),
		headers: { 'content-type': 'image/png' },
		nested: [Buffer.from('a'), { deep: Buffer.from('b') }],
	}
	const json = JSON.stringify(original, replaceBuffers)
	expect(json).not.toMatch(/"data":\[/)

	const revived = reviveBuffers(JSON.parse(json))
	expect(revived).toEqual(original)
	expect(Buffer.isBuffer(revived.body)).toBe(true)
})

it('round-trips an empty buffer', () => {
	const json = JSON.stringify({ body: Buffer.alloc(0) }, replaceBuffers)
	expect(json).toBe('{"body":{"type":"Buffer","data":""}}')
	expect(reviveBuffers(JSON.parse(json)).body).toEqual(Buffer.alloc(0))
})

it('leaves non-buffer values untouched when used as a replacer', () => {
	const value = { a: 1, b: 'two', c: [3, { d: null }], e: { type: 'Buffer' } }
	expect(JSON.stringify(value, replaceBuffers)).toBe(JSON.stringify(value))
})
