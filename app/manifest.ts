import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "OddsOracle — Free Multi-Sport Betting Predictions",
    short_name: "OddsOracle",
    description:
      "Daily football, basketball and tennis picks from a Forebet + model fusion engine. Free, honest, updated daily.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#05080f",
    theme_color: "#05080f",
    categories: ["sports", "news", "utilities"],
    lang: "en-NG",
    dir: "ltr",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      {
        name: "Today's Picks",
        short_name: "Picks",
        url: "/predictions/",
        icons: [{ src: "/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Football Tips",
        short_name: "Football",
        url: "/predictions/football/",
        icons: [{ src: "/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Track Record",
        short_name: "Record",
        url: "/track-record/",
        icons: [{ src: "/icon-192.png", sizes: "192x192" }],
      },
    ],
  };
}
