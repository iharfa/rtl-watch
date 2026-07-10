/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  // ponytail: strict-mode double-mount bricks MapLibre style loading — keep off
  reactStrictMode: false,
};

export default nextConfig;
