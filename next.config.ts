import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Hide the on-screen dev route indicator; compile and runtime errors still show.
  devIndicators: false,
  experimental: {
    // Load each route's server code on first request instead of all at boot,
    // keeping idle memory low on small instances (e.g. Render's 512 MB tier).
    preloadEntriesOnStart: false,
  },
};

export default nextConfig;
