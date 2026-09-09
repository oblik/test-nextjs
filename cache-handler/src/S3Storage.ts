import { S3, S3ServiceException } from "@aws-sdk/client-s3";
import { createLogger } from "./debug";
import type { HandlerStorage } from "./types";

/**
 * Stores cache entries as objects in an S3 bucket.
 * @todo Add ETag support, to prevent unnecessary network overhead.
 */
export class S3Storage implements HandlerStorage {
  log = createLogger("S3Storage");
  client: S3;

  constructor(
    protected bucket: string,
    protected region: string,
  ) {
    this.bucket = bucket;
    this.client = new S3({ region, forcePathStyle: true });
  }

  async get(key: string): Promise<Buffer | null> {
    this.log?.(`get: ${key}`);
    const data = await this.client
      .getObject({ Bucket: this.bucket, Key: key })
      .catch((error) => {
        if (!(error instanceof S3ServiceException)) throw error;
        if (["NotFound", "NoSuchKey"].includes(error.name)) return null;
        throw error;
      });

    if (!data?.Body) return null;
    return Buffer.from(await data.Body.transformToByteArray());
  }

  async put(key: string, body: Buffer): Promise<void> {
    this.log?.(`put: ${key}`);
    await this.client.putObject({
      Bucket: this.bucket,
      Key: key,
      Body: body,
    });
  }
}
