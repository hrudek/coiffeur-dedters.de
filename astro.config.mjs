// @ts-check
import { defineConfig } from "astro/config";

import tailwindcss from "@tailwindcss/vite";
import sitemap from "@astrojs/sitemap";

// https://astro.build/config
export default defineConfig({
  site: "https://coiffeur-dedters.de",
  trailingSlash: "never",
  build: { format: "file" },
  image: {
    // Platzhalterbilder der alten Seite (Storyblok-CDN)
    domains: ["a.storyblok.com"],
  },
  vite: {
    plugins: [tailwindcss()],
  },
  integrations: [
    sitemap({
      filter: (page) => !page.endsWith("/danke"),
    }),
  ],
});
