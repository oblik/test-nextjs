// @vitest-environment node
import { mkdtemp, readdir, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { FsStorage } from './fs'

let root: string
let storage: FsStorage

beforeEach(async () => {
	root = await mkdtemp(join(tmpdir(), 'cache-handler-fs-'))
	storage = new FsStorage(root)
})

afterEach(async () => {
	await rm(root, { recursive: true, force: true })
})

async function exists(key: string) {
	return stat(join(root, ...key.split('/')))
		.then(() => true)
		.catch(() => false)
}

describe('get/put', () => {
	it('round-trips a nested key, creating parent directories', async () => {
		const key = 'build/x/page/123/us/en/banner_ids=&eea=false.json'
		await storage.put(key, Buffer.from('{"a":1}'))
		expect(await storage.get(key)).toEqual(Buffer.from('{"a":1}'))
	})

	it('returns null for a missing key', async () => {
		expect(await storage.get('build/x/missing.json')).toBeNull()
	})

	it('overwrites an existing key without leaving temp files', async () => {
		const key = 'build/x/page/1.json'
		await storage.put(key, Buffer.from('first'))
		await storage.put(key, Buffer.from('second'))
		expect(await storage.get(key)).toEqual(Buffer.from('second'))
		expect(await readdir(join(root, 'build/x/page'))).toEqual(['1.json'])
	})

	it('survives concurrent writes to the same key', async () => {
		const key = 'build/x/page/1.json'
		await Promise.all(
			Array.from({ length: 20 }, (_, i) =>
				storage.put(key, Buffer.from(JSON.stringify({ i })))
			)
		)
		const body = await storage.get(key)
		expect(body).not.toBeNull()
		const { i } = JSON.parse(body!.toString('utf-8'))
		expect(i).toBeGreaterThanOrEqual(0)
		expect(i).toBeLessThan(20)
	})

	it('refuses keys that escape the root', async () => {
		await expect(storage.get('../outside.json')).rejects.toThrow(/escapes/)
	})
})

describe('deletePrefix', () => {
	const seeded = [
		'build/x/page/123.json',
		'build/x/page/123/us/en/eea=true.json',
		'build/x/page/123/us/bg/eea=false.json',
		'build/x/page/1234/us/en/eea=true.json',
		'build/x/page/12.json',
		'build/x/page/5/a.json',
		'build/x/page.json',
		'build/x/page-2/a.json',
		'build/y/page/123.json',
	]

	beforeEach(async () => {
		await Promise.all(seeded.map((key) => storage.put(key, Buffer.from(key))))
	})

	it('matches S3 prefix semantics, including the "1234" over-match', async () => {
		const deleted = await storage.deletePrefix('build/x/page/123')

		expect(deleted.sort()).toEqual([
			'build/x/page/123.json',
			'build/x/page/123/us/bg/eea=false.json',
			'build/x/page/123/us/en/eea=true.json',
			// Not a real match for `page/123`, but S3 prefix matching is over the
			// literal string, so it goes too. Preserved for parity.
			'build/x/page/1234/us/en/eea=true.json',
		])

		for (const key of deleted) expect(await exists(key)).toBe(false)
		expect(await exists('build/x/page/12.json')).toBe(true)
		expect(await exists('build/x/page/5/a.json')).toBe(true)
		expect(await exists('build/y/page/123.json')).toBe(true)
	})

	it('deletes everything under a trailing-slash prefix, but not siblings', async () => {
		const deleted = await storage.deletePrefix('build/x/page/')

		expect(deleted).toHaveLength(6)
		expect(await exists('build/x/page')).toBe(true) // the dir itself stays
		expect(await readdir(join(root, 'build/x/page'))).toEqual([])
		expect(await exists('build/x/page.json')).toBe(true)
		expect(await exists('build/x/page-2/a.json')).toBe(true)
	})

	it('returns an empty array for a prefix that matches nothing', async () => {
		expect(await storage.deletePrefix('build/x/nope')).toEqual([])
		expect(await storage.deletePrefix('build/z/page/1')).toEqual([])
	})

	it('deletes nothing for prefixes with empty segments', async () => {
		// `revalidatePath('/')` yields the prefix `build/x//`.
		expect(await storage.deletePrefix('build/x//')).toEqual([])
		expect(await storage.deletePrefix('')).toEqual([])
		expect(await storage.deletePrefix('/')).toEqual([])
		for (const key of seeded) expect(await exists(key)).toBe(true)
	})
})
