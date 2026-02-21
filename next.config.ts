import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    turbopackUseBuiltinBabel: true,
  },
  serverExternalPackages: ["better-sqlite3"],
  turbopack: {
    resolveAlias: {
      "solid-js/web": "solid-js/web/dist/web.js",
    },
    rules: {
      "./solid-admin/**/*.tsx": {
        loaders: [
          {
            loader: "babel-loader",
            options: {
              presets: ["babel-preset-solid", "@babel/preset-typescript"],
            },
          },
        ],
        as: "*.js",
      },
    },
  },
};

export default nextConfig;
