import { expect, it } from 'vitest'
import { compress, decode, decompress, encode } from './compress'

it('round-trips a buffer through compress and decompress', async () => {
	const original = Buffer.from(JSON.stringify({ hello: 'world', n: 42 }))
	const compressed = await compress(original)
	const result = await decompress(compressed)
	expect(result).toEqual(original)
})

it('shrinks large repetitive payloads', async () => {
	const original = Buffer.from(JSON.stringify({ data: Array(10_000).fill(7) }))
	const compressed = await compress(original)
	expect(compressed.length).toBeLessThan(original.length)
})

it('round-trips large text through encode and decode, smaller than base64 would be', async () => {
	const text = JSON.stringify({ data: Array(10_000).fill(7) })
	const encoded = await encode(text)
	expect(encoded.length).toBeLessThan(text.length)

	const compressed = await compress(Buffer.from(text, 'utf-8'))
	expect(encoded.length).toBeLessThan(compressed.toString('base64').length)

	expect(await decode(encoded)).toBe(text)
})

it('round-trips small text through encode and decode', async () => {
	const text = JSON.stringify({ hello: 'world' })
	expect(await decode(await encode(text))).toBe(text)
})
