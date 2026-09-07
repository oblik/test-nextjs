/**
 * `JSON.stringify` replacer that emits Buffers as base64 instead of Node's
 * default number array (`{ type: 'Buffer', data: [12, 34, ...] }`, roughly
 * 3.5 chars per byte). `Buffer#toJSON` runs *before* the replacer, so `value`
 * is already that plain object; the holder (`this[key]`) still has the
 * original Buffer, which is what's checked here.
 *
 * Reversed by {@link reviveBuffers}, which accepts both forms.
 */
export function replaceBuffers(
	this: Record<string, unknown>,
	key: string,
	value: unknown
): unknown {
	const original = this[key]
	if (Buffer.isBuffer(original)) {
		return { type: 'Buffer', data: original.toString('base64') }
	}
	return value
}

/**
 * Turns `JSON.parse`d Buffer placeholders back into Buffers, in place. Handles
 * both the base64 string form written by {@link replaceBuffers} and Node's
 * default number array form, so entries written with either setting of
 * `CACHE_BASE64` stay readable.
 */
export function reviveBuffers<T>(obj: T): T {
	if (!obj || typeof obj !== 'object') return obj

	if (Array.isArray(obj)) {
		// Deliberately widened to `any` because the mapped array is a different
		// shape than `T`, but is still valid for `T` (Buffers replacing the
		// placeholder objects).
		return obj.map(reviveBuffers) as any
	}

	if ('type' in obj && obj.type === 'Buffer' && 'data' in obj) {
		if (typeof obj.data === 'string') {
			return Buffer.from(obj.data, 'base64') as any
		}
		if (Array.isArray(obj.data)) {
			return Buffer.from(obj.data) as any
		}
	}

	const record = obj as Record<string, unknown>
	for (const key in record) {
		if (!Object.hasOwn(record, key)) continue
		record[key] = reviveBuffers(record[key])
	}

	return obj
}
