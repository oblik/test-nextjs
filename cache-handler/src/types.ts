/**
 * Minimal key/value store the cache handler needs. Keys are the **full** object
 * keys (including the `build/<id>/` prefix) and values are opaque byte
 * buffers; JSON (de)serialization and compression are the handler's job.
 */
export interface HandlerStorage {
  /** Raw bytes, or `null` when the key doesn't exist. */
  get(key: string): Promise<Buffer | null>;
  put(key: string, body: Buffer): Promise<void>;
  /**
   * Deletes every key that starts with `prefix` (S3 prefix semantics) and
   * returns the deleted keys, or an empty array when nothing matched.
   */
  deletePrefix(prefix: string): Promise<string[]>;
}
