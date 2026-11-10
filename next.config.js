/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    // Isolate legacy JS page helper exports when Vite TS files exist under app/web-chat
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  async redirects() {
    return [
      {
        source: '/roles/sm',
        destination: '/dashboard?role=sm',
        permanent: false,
      },
      {
        source: '/roles/md',
        destination: '/dashboard?role=md',
        permanent: false,
      },
      {
        source: '/roles/asm',
        destination: '/dashboard?role=asm',
        permanent: false,
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: '/videos/v1.mp4',
        destination: 'https://cdn.jsdelivr.net/gh/deepub144-creative/Dark-Store-Operations-Warehouse-Blinkit-@main/public/videos/v1.mp4',
      },
      {
        source: '/videos/AK.mp4',
        destination: 'https://cdn.jsdelivr.net/gh/deepub144-creative/Dark-Store-Operations-Warehouse-Blinkit-@main/public/videos/AK.mp4',
      },
      {
        source: '/frames/:path*',
        destination: 'https://cdn.jsdelivr.net/gh/deepub144-creative/Dark-Store-Operations-Warehouse-Blinkit-@main/public/frames/:path*',
      },
    ];
  },
};

module.exports = nextConfig;
