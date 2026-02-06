/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  transpilePackages: ['three', '@pixiv/three-vrm'],
  devIndicators: false,
}

export default nextConfig
