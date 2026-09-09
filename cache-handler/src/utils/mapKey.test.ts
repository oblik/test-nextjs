import { expect, it } from 'vitest'
import { mapKey } from './mapKey'

function test(input: string, output: string) {
	expect(mapKey(input)).toBe(output)
}

it('maps keys without attr paths', () => {
	test('/favicon.ico', 'favicon.ico.json')
})

it('maps home page', () => {
	test(
		'/page/locale=en&type=page&slug=home&eea=false',
		'page/home/en/eea=false.json'
	)
})

it('maps blog first page', () => {
	test(
		// This is an edge case because the first page doesn't have its number in
		// the URL, even though we add it in the attr path.
		'/blog-listing/locale=en&type=blog-listing&page=1&eea=true',
		'blog-listing/1/en/eea=true.json'
	)
})

it('maps blog any page', () => {
	test(
		'/blog-listing/locale=en&type=blog-listing&page=5&eea=true',
		'blog-listing/5/en/eea=true.json'
	)
})

it('maps blog post', () => {
	test(
		'/blog-post/locale=en&type=blog-post&slug=what-is-crypto-lending&eea=true',
		'blog-post/what-is-crypto-lending/en/eea=true.json'
	)
})

it('maps non-English route', () => {
	test(
		'/page/locale=es-la&type=page&slug=home&eea=true',
		'page/home/es-la/eea=true.json'
	)
})

it('maps route without a locale', () => {
	test('/brand/locale=en&type=brand&eea=true', 'brand/en/eea=true.json')
})

it('sorts attributes', () => {
	test(
		'/page/locale=en&type=page&id=123&eea=true&country=AR',
		'page/123/en/country=AR&eea=true.json'
	)
})

it('maps both regions and locales', () => {
	test(
		'/page/region=us&locale=en&id=123&banner_ids=&eea=false',
		'page/123/us/en/banner_ids=&eea=false.json'
	)
})
