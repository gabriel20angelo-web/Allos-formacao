/** @type {import('next').NextConfig} */
const nextConfig = {
  assetPrefix: 'https://allos-formacao-production.up.railway.app',
  async rewrites() {
    const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
    if (!supabaseUrl) return [];
    return [
      {
        source: '/_sb/:path*',
        destination: `${supabaseUrl}/:path*`,
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/_next/static/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
        ],
      },
      {
        source: '/formacao/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, max-age=0' },
          { key: 'Pragma', value: 'no-cache' },
        ],
      },
      {
        source: '/api/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, max-age=0' },
          { key: 'Pragma', value: 'no-cache' },
        ],
      },
    ];
  },
  images: {
    path: 'https://allos-formacao-production.up.railway.app/_next/image',
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "img.youtube.com",
      },
      {
        protocol: "https",
        hostname: "i.ytimg.com",
      },
    ],
  },
};

export default nextConfig;
