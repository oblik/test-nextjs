import type { ListObjectsV2CommandOutput } from '@aws-sdk/client-s3'
import { S3, S3ServiceException } from '@aws-sdk/client-s3'
import type { PutOptions, Storage } from './types'

/** Stores cache entries as objects in an S3 bucket. */
export class S3Storage implements Storage {
	bucket: string
	client: S3

	constructor({ bucket, region }: { bucket: string; region: string }) {
		this.bucket = bucket
		this.client = new S3({
			region,
			forcePathStyle: true,
		})
	}

	async get(key: string): Promise<Buffer | null> {
		const data = await this.client
			.getObject({ Bucket: this.bucket, Key: key })
			.catch((error) => {
				if (!(error instanceof S3ServiceException)) throw error
				if (['NotFound', 'NoSuchKey'].includes(error.name)) return null
				throw error
			})

		if (!data?.Body) return null
		return Buffer.from(await data.Body.transformToByteArray())
	}

	async put(key: string, body: Buffer, options?: PutOptions): Promise<void> {
		await this.client.putObject({
			Bucket: this.bucket,
			Key: key,
			Body: body,
			CacheControl: options?.maxAge ? `max-age=${options.maxAge}` : undefined,
		})
	}

	async deletePrefix(prefix: string): Promise<string[]> {
		const keys: string[] = []
		let continuationToken: string | undefined = undefined

		do {
			const response: ListObjectsV2CommandOutput =
				await this.client.listObjectsV2({
					Bucket: this.bucket,
					ContinuationToken: continuationToken,
					Prefix: prefix,
				})
			continuationToken = response.NextContinuationToken

			for (const object of response.Contents ?? []) {
				if (object.Key) keys.push(object.Key)
			}
		} while (continuationToken)

		if (!keys.length) return keys

		await this.client.deleteObjects({
			Bucket: this.bucket,
			Delete: { Objects: keys.map((Key) => ({ Key })) },
		})
		return keys
	}
}
