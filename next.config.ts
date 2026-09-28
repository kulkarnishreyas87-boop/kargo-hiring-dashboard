import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse (via pdfjs-dist) resolves its worker script relative to its own
  // file location at runtime; Next's bundler rewrites that into a chunk path
  // that doesn't exist, breaking PDF uploads. Leaving it unbundled makes it
  // load straight from node_modules instead, where that relative path is real.
  serverExternalPackages: ["pdf-parse", "pdfjs-dist", "@napi-rs/canvas"],
};

export default nextConfig;
