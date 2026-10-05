import type { MetadataRoute } from "next";

// Web app manifest (SPEC 13): installable, standalone, with a Share Target for text, images and PDF (Android).
export default function manifest(): MetadataRoute.Manifest {
  const name = process.env.APP_NAME ?? "Home Ledger";
  return {
    name,
    short_name: name.slice(0, 12),
    description: "Personal finance on your own server",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#F2F4F1",
    theme_color: "#0B5D4B",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    share_target: {
      action: "/share-target",
      method: "POST",
      enctype: "multipart/form-data",
      params: { title: "title", text: "text", url: "url", files: [{ name: "file", accept: ["image/jpeg", "image/png", "image/webp", "application/pdf"] }] },
    },
  } as MetadataRoute.Manifest;
}
