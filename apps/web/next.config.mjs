/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ["@pd/shared", "@pd/sim"],
};

export default nextConfig;
