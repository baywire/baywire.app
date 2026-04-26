import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.eventbrite.com" },
      { protocol: "https", hostname: "img.evbuc.com" },
      { protocol: "https", hostname: "cdn.evbuc.com" },
      { protocol: "https", hostname: "**.visittampabay.com" },
      { protocol: "https", hostname: "**.visitstpeteclearwater.com" },
      { protocol: "https", hostname: "**.tampabay.com" },
      { protocol: "https", hostname: "**.cloudfront.net" },
      { protocol: "https", hostname: "**.googleusercontent.com" },
    ],
  },
};

export default nextConfig;
