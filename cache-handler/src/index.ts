import { BUILD_ID_FILE } from 'next/constants.js'
import type {
	CacheHandler,
	CacheHandlerContext,
	CacheHandlerValue,
} from 'next/dist/server/lib/incremental-cache'
import type {
	IncrementalCacheValue,
	SetIncrementalFetchCacheContext,
	SetIncrementalResponseCacheContext,
} from 'next/dist/server/response-cache'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { decode, encode } from './compress'
import { isErrno } from './isErrno'
import { mapKey } from './mapKey'
import { replaceBuffers, reviveBuffers } from './reviveBuffers'
import { createStorage } from './storage/index'
import type { Storage } from './storage/types'

const DEBUG = process.env.PINO_LOG_LEVEL === 'trace'
const { CACHE_S3_BUCKET, CACHE_S3_REGION, CACHE_COMPRESS, CACHE_BASE64 } =
	process.env

/**
 * Whether to Brotli-compress cache entries. Defaults to on when actually
 * persisting to S3 (the reason to compress at all) and off for local
 * filesystem storage, so entries stay plain, readable JSON when debugging
 * locally. Override either way with `CACHE_COMPRESS=1` / `CACHE_COMPRESS=0`.
 */
function shouldCompress(): boolean {
	if (CACHE_COMPRESS === '1') return true
	if (CACHE_COMPRESS === '0') return false
	return Boolean(CACHE_S3_BUCKET && CACHE_S3_REGION)
}

/**
 * Whether to store Buffers in cache entries (e.g. `APP_ROUTE` bodies) as
 * base64 rather than JSON's default number array, which costs ~3.5 chars per
 * byte and is slow to parse. Defaults to on for every storage backend: unlike
 * compression there's no readability to preserve locally, since neither form
 * is human-readable (base64 at least decodes with `base64 -d`). Override with
 * `CACHE_BASE64=1` / `CACHE_BASE64=0`. Reading accepts both forms regardless,
 * see {@link reviveBuffers}.
 */
function shouldBase64(): boolean {
	if (CACHE_BASE64 === '1') return true
	if (CACHE_BASE64 === '0') return false
	return true
}

/**
 * Matches `@/utils/parallelize`'s type without importing its implementation:
 * this directory is kept dependency-free of the rest of the app.
 */
type Parallelize = <T extends unknown[]>(promises: {
	[K in keyof T]: Promise<T[K]>
}) => Promise<T>

const parallelize: Parallelize = (promises) => Promise.all(promises)

function isCacheValue(value: unknown): value is CacheHandlerValue {
	return Boolean(value && typeof value === 'object' && 'value' in value)
}

/**
 * Needed as an abstraction because Next creates a new Handler instance **on
 * each and every request**. So you can't use the {@link Handler} class to store
 * state (like the `buildId` and the `storage` backend).
 */
class HandlerConfig {
	buildId: string
	storage: Storage
	/** Whether cache entries are Brotli-compressed. */
	compress: boolean
	/** Whether Buffers in cache entries are stored as base64. */
	base64: boolean

	constructor(
		buildId: string,
		storage: Storage,
		compress: boolean,
		base64: boolean
	) {
		this.buildId = buildId
		this.storage = storage
		this.compress = compress
		this.base64 = base64
	}

	getBuildPrefix(suffix: string): string {
		return `build/${this.buildId}/` + suffix
	}

	getKey(key: string): string {
		let result = this.getBuildPrefix(mapKey(key))
		if (this.compress) result += '.br'
		if (DEBUG) console.log(`Mapped ${key} to ${result}`)
		return result
	}

	/** Tracks total number of cache handler invocations. */
	invokeCount = 0
}

/**
 * Note that Next creates a new instance of the class **on each request**.
 */
export default class Handler implements CacheHandler {
	context: CacheHandlerContext

	constructor(_ctx: CacheHandlerContext) {
		this.context = _ctx
	}

	static config: HandlerConfig | undefined

	async getConfig(): Promise<HandlerConfig> {
		// Use a pre-existing config, if there is one, to avoid reading the
		// `BUILD_ID` file and creating a new storage client **on each request**.
		if (Handler.config) return Handler.config

		const distDir = this.context.serverDistDir
		if (!distDir) throw new Error('Server dist dir is not set')

		// The ignore comment stops Turbopack's file tracer from following `..` up
		// from an unknown directory, which otherwise makes it trace (and warn
		// about) the entire project.
		const filepath = join(
			/*turbopackIgnore: true*/ distDir,
			'..',
			BUILD_ID_FILE
		)
		const buildId = await readFile(
			/*turbopackIgnore: true*/ filepath,
			'utf-8'
		).catch((error) => {
			// `next dev` doesn't write a `BUILD_ID` file. It also doesn't cache
			// pages through this handler, but it may still call `get` for cached
			// `fetch` calls, and Next doesn't catch `get` errors.
			if (this.context.dev && isErrno(error, 'ENOENT')) return 'development'
			throw error
		})
		console.log(`Retrieved build ID ${buildId} from ${filepath}`)

		if (DEBUG) console.log('Creating handler config')
		return (Handler.config = new HandlerConfig(
			buildId,
			createStorage(distDir),
			shouldCompress(),
			shouldBase64()
		))
	}

	/** Invokes a function and measures the time it took to complete, if debugging. */
	async invoke<T>(
		name: string,
		callback: (config: HandlerConfig) => Promise<T>
	): Promise<T> {
		const config = await this.getConfig()
		if (!DEBUG) return callback(config)

		const count = ++config.invokeCount
		const start = performance.now()
		console.log({ cacheHandler: 'start', id: count, name })
		const result = await callback(config)
		const time = performance.now() - start
		console.log({ cacheHandler: 'stop', id: count, name, ms: time })
		return result
	}

	async get(_cacheKey: string): Promise<CacheHandlerValue | null> {
		return this.invoke(`get ${_cacheKey}`, async (config) => {
			const body = await config.storage.get(config.getKey(_cacheKey))
			if (!body) return null

			const json = config.compress ? await decode(body) : body.toString('utf-8')
			const parsedJson = JSON.parse(json)
			return isCacheValue(parsedJson) ? reviveBuffers(parsedJson) : null
		})
	}

	async set(
		_cacheKey: string,
		_data: IncrementalCacheValue | null,
		_ctx: SetIncrementalFetchCacheContext | SetIncrementalResponseCacheContext
	): Promise<void> {
		return this.invoke(`put ${_cacheKey}`, async (config) => {
			if (!_data) return

			if (_data.kind !== 'APP_ROUTE' && _data.kind !== 'APP_PAGE') {
				throw new Error(`Cache kind not supported: ${_data.kind}`)
			}

			if ('rscData' in _data) {
				// Not really getting used because we force a browser refresh on each
				// link click. Removing it reduces cache artifact size by ~75%.
				delete _data.rscData
			}

			const value: CacheHandlerValue = {
				lastModified: Date.now(),
				value: _data,
			}
			const revalidate =
				'cacheControl' in _ctx ? _ctx.cacheControl?.revalidate : null

			// Buffers (e.g. `APP_ROUTE` bodies) go out as base64, see replaceBuffers().
			const json = JSON.stringify(
				value,
				config.base64 ? replaceBuffers : undefined
			)
			const body = config.compress
				? await encode(json)
				: Buffer.from(json, 'utf-8')

			await config.storage.put(config.getKey(_cacheKey), body, {
				maxAge: revalidate || undefined,
			})
		})
	}

	async deletePrefix(config: HandlerConfig, prefix: string): Promise<void> {
		const deleted = await config.storage.deletePrefix(
			config.getBuildPrefix(prefix)
		)

		if (!deleted.length) {
			console.log(`Nothing to delete for: ${prefix}`)
			return
		}

		if (DEBUG) console.log(`Deleted objects: ${deleted}`)
	}

	async revalidateTag(tags: string | string[]): Promise<void> {
		return this.invoke(`revalidateTag ${tags}`, async (config) => {
			// Next.js sends a tags **array** when you call `revalidatePath` multiple
			// times in one request, otherwise a single string.
			if (!Array.isArray(tags)) tags = [tags]

			await parallelize(
				tags.map((tag) => {
					// Calling `revalidatePath('foo')` results in automatic `_N_T_`
					// addition at the front, e.g. `_N_T_page/home`.
					const prefix = tag.replace('_N_T_', '')

					return this.deletePrefix(config, prefix)
				})
			)
		})
	}

	resetRequestCache(): void {
		// Per-request cache not supported
	}
}
