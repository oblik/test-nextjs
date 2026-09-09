import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  cacheHandlers: {
    default: require.resolve("./cache-handler/default.mjs"),
    sticky: require.resolve("./cache-handler/sticky.mjs"),
  },
};

export default nextConfig;
