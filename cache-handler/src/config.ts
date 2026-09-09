export const { CACHE_S3_BUCKET, CACHE_S3_REGION, NEXT_CACHE_S3_DEBUG } =
  process.env;

export const IS_DEBUG = Boolean(NEXT_CACHE_S3_DEBUG);
