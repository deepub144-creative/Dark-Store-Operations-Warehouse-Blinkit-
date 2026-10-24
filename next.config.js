/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: '/videos/v1.mp4',
        destination: 'https://raw.githubusercontent.com/deepub144-creative/Dark-Store-Operations-Warehouse-Blinkit-/main/public/videos/v1.mp4',
      },
      {
        source: '/videos/AK.mp4',
        destination: 'https://raw.githubusercontent.com/deepub144-creative/Dark-Store-Operations-Warehouse-Blinkit-/main/public/videos/AK.mp4',
      },
      {
        source: '/frames/:path*',
        destination: 'https://raw.githubusercontent.com/deepub144-creative/Dark-Store-Operations-Warehouse-Blinkit-/main/public/frames/:path*',
      },
    ];
  },
};

module.exports = nextConfig;
