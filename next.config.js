/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['three', '@pixiv/three-vrm'],
  devIndicators: false,
}

export default nextConfig
