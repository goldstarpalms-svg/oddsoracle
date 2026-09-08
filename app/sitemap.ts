import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";
import { SPORTS, type Sport } from "@/lib/predictions";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPages = [
    "",
    "/predictions/",
    "/about/",
    "/contact/",
    "/faq/",
    "/responsible-gambling/",
    "/terms/",
    "/privacy/",
    "/disclaimer/",
  ];

  const sportPages = (Object.keys(SPORTS) as Sport[]).map(
    (sport) => `/predictions/${sport}/`,
  );

  const all = [...staticPages, ...sportPages];

  return all.map((p) => ({
    url: `${SITE.url}${p}`,
    lastModified: new Date(),
    changeFrequency: "daily",
    priority: p === "" ? 1 : p.startsWith("/predictions") ? 0.8 : 0.5,
  }));
}
