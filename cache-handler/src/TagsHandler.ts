import type {
	CacheEntry,
	CacheHandler,
	Timestamp,
} from 'next/dist/server/lib/cache-handlers/types'
import type { Storage } from './storage/types'

export class TagsHandler implements CacheHandler {
	constructor(public storage: Storage) {}

	refreshTags(): Promise<void> {
		console.log(this)
		return undefined as any
	}

	get(cacheKey: string, softTags: string[]): Promise<undefined | CacheEntry> {
		return undefined as any
	}

	set(cacheKey: string, pendingEntry: Promise<CacheEntry>): Promise<void> {
		return undefined as any
	}

	getExpiration(tags: string[]): Promise<Timestamp> {
		return undefined as any
	}

	updateTags(tags: string[], durations?: { expire?: number }): Promise<void> {
		return undefined as any
	}
}
