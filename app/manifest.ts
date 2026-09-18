import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "OddsOracle — Free Multi-Sport Betting Predictions",
    short_name: "OddsOracle",
    description:
      "Daily football, basketball and tennis picks from a Forebet + model fusion engine. Free, honest, updated daily.",
    start_url: "/",
    display: "standalone",
    background_color: "#05080f",
    theme_color: "#05080f",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
