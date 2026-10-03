import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MUBAZZAR — Uncommon Gadgets",
    short_name: "MUBAZZAR",
    description: "Uncommon gadgets and viral problem solvers delivered across Nigeria.",
    start_url: "/",
    display: "standalone",
    background_color: "#FBF9F5",
    theme_color: "#0E294B",
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
