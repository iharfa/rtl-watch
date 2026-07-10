/** @type {import('next').NextConfig} */
const nextConfig = {
  // no static export — /api/sync runs as a Vercel function against Neon
  trailingSlash: true,
  // ponytail: strict-mode double-mount bricks MapLibre style loading — keep off
  reactStrictMode: false,
};

export default nextConfig;
