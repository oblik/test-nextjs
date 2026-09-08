import type { ListObjectsV2CommandOutput } from "@aws-sdk/client-s3";
import { S3, S3ServiceException } from "@aws-sdk/client-s3";
import { createLogger, type Logger } from "../createLogger";
import type { HandlerStorage } from "./types";

/** Stores cache entries as objects in an S3 bucket. */
export class S3Storage implements HandlerStorage {
  bucket: string;
  client: S3;
  log: Logger;

  constructor({ bucket, region }: { bucket: string; region: string }) {
    this.bucket = bucket;
    this.client = new S3({
      region,
      forcePathStyle: true,
    });
    this.log = createLogger("S3Storage");
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

  async deletePrefix(prefix: string): Promise<string[]> {
    const keys: string[] = [];
    let continuationToken: string | undefined = undefined;

    do {
      const response: ListObjectsV2CommandOutput =
        await this.client.listObjectsV2({
          Bucket: this.bucket,
          ContinuationToken: continuationToken,
          Prefix: prefix,
        });
      continuationToken = response.NextContinuationToken;

      for (const object of response.Contents ?? []) {
        if (object.Key) keys.push(object.Key);
      }
    } while (continuationToken);

    if (!keys.length) return keys;

    await this.client.deleteObjects({
      Bucket: this.bucket,
      Delete: { Objects: keys.map((Key) => ({ Key })) },
    });
    return keys;
  }
}
