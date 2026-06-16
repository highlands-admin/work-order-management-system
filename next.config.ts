import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produce a self-contained server bundle (.next/standalone) so the IONOS
  // deploy ships only the files it needs to run `node server.js`.
  output: "standalone",
};

export default nextConfig;
