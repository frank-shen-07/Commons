import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Hide the on-screen dev route indicator; compile and runtime errors still show.
  devIndicators: false,
  experimental: {
    // Load each route's server code on first request instead of all at boot,
    // keeping idle memory low on small instances (e.g. Render's 512 MB tier).
    preloadEntriesOnStart: false,
  },
  // /public files default to max-age=0, so every visit revalidates them.
  // Fonts never change in place; images are cached for a day.
  async headers() {
    return [
      {
        source: "/fonts/:file*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/images/:file*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, stale-while-revalidate=604800",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
