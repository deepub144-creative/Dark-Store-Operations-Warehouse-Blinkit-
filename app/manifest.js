export default function manifest() {
  return {
    name: "AUDIT'X — 10-Min Dark Store Hub",
    short_name: "AUDIT'X",
    description:
      "AUDIT'X Quick-Commerce Customer, OD Picker & Order Captain Express Suite for Tiptur Hub KA44.",
    start_url: "/ordering",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#F2F2F7",
    theme_color: "#007AFF",
    categories: ["shopping", "food", "business"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any maskable",
      },
    ],
  };
}

