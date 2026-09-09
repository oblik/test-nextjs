function decodeAttrs(input: string): Record<string, unknown> {
	return Object.fromEntries(input.split('&').map((kv) => kv.split('=')))
}

function encodeAttrs(input: object): string {
	return Object.entries(input)
		.map(([k, v]) => `${k}=${v}`)
		.sort()
		.join('&')
}

export function mapKey(key: string): string {
	key = key.replace(/^\/+/g, '') // remove leading slashes

	const split = key.split('/')
	const attrsString = split.pop()
	if (
		typeof attrsString !== 'string' ||
		!attrsString.includes('=') ||
		split.length !== 1
	) {
		return `${key}.json`
	}

	const attrs = decodeAttrs(attrsString)
	delete attrs.type

	let result = split[0]

	const subdir = attrs.id || attrs.slug || attrs.page
	delete attrs.id
	delete attrs.slug
	delete attrs.page
	if (subdir) result += `/${subdir}`

	const region = attrs.region
	delete attrs.region
	if (region) result += `/${region}`

	const locale = attrs.locale
	delete attrs.locale
	if (locale) result += `/${locale}`

	result += `/${encodeAttrs(attrs)}.json`

	return result
}
