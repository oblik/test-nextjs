import { promisify } from 'node:util'
import { brotliCompress, brotliDecompress, constants } from 'node:zlib'

const compressAsync = promisify(brotliCompress)
const decompressAsync = promisify(brotliDecompress)

export function compress(buffer: Buffer): Promise<Buffer> {
	return compressAsync(buffer, {
		params: {
			[constants.BROTLI_PARAM_QUALITY]: 5,
			[constants.BROTLI_PARAM_SIZE_HINT]: buffer.length,
		},
	})
}

export function decompress(buffer: Buffer): Promise<Buffer> {
	return decompressAsync(buffer)
}

/** Brotli-compresses `json`. */
export async function encode(json: string): Promise<Buffer> {
	return compress(Buffer.from(json, 'utf-8'))
}

/** Reverses {@link encode}. */
export async function decode(body: Buffer): Promise<string> {
	return (await decompress(body)).toString('utf-8')
}
