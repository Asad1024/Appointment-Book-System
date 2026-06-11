const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    missingSuspenseWithCSRBailout: false,
  },
  webpack: (config) => {
    config.resolve.alias['@pkg/shared-types'] = path.resolve(
      __dirname,
      'packages/shared-types/src',
    );
    return config;
  },
};

module.exports = nextConfig;
