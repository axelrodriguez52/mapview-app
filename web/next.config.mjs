/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  basePath: '/mapview-app',
  trailingSlash: true,
  images: { unoptimized: true },
  turbopack: { root: import.meta.dirname }
};

export default nextConfig;
