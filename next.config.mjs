/** @type {import('next').NextConfig} */
const nextConfig = {
  // Real-time / hybrid mode: we run an API route so the hero "Today's picks"
  // panel can fetch fresh picks without a rebuild. Main SEO pages still
  // prerender statically by default in the App Router.
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
  experimental: { serverComponentsExternalPackages: [] },
};

export default nextConfig;
