/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The Thru SDK ships modern ESM that Next needs to transpile for the
  // client bundle (it uses top-level features + WebCrypto helpers).
  transpilePackages: ['@thru/sdk', '@thru/programs', '@thru/passkey'],
  webpack: (config) => {
    // The SDK targets the browser; make sure node core polyfills aren't pulled in.
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    };
    return config;
  },
};

export default nextConfig;
