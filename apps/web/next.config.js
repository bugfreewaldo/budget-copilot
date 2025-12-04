/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@budget-copilot/ui', '@budget-copilot/core'],
  eslint: {
    dirs: ['src'],
  },
};

module.exports = nextConfig;
