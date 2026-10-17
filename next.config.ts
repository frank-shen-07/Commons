import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Hide the on-screen dev route indicator; compile and runtime errors still show.
  devIndicators: false,
};

export default nextConfig;
