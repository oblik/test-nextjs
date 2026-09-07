import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  experimental: {
    // Required for the "use cache" directive.
    useCache: true,
  },
  // Custom cache handler for "use cache" entries (see cache-handler.js).
  // Must be an absolute path: Next resolves relative paths against the
  // build output directory (e.g. .next/dev), not the project root.
  cacheHandlers: {
    default: path.join(__dirname, "cache-handler/default.mjs"),
  },
};

export default nextConfig;
