/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      { source: '/auth/verify-email', destination: '/verify-email', permanent: true },
      { source: '/auth/callback', destination: '/api/auth/callback', permanent: true },
      { source: '/auth/reset-password', destination: '/reset-password', permanent: true },
      { source: '/auth/auth-code-error', destination: '/auth-code-error', permanent: true },
    ];
  },
};

module.exports = nextConfig;