import { defineConfig } from "vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";
import { fileURLToPath } from "node:url";

// Portable, vendor-neutral config: standard TanStack Start + Vite.
// Deploy target is controlled by the NITRO_PRESET env var, e.g.
//   NITRO_PRESET=node-server   (default: any Node host, Docker, VPS, Render, Fly...)
//   NITRO_PRESET=vercel | netlify | cloudflare-module | bun | deno-deploy
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
    dedupe: ["react", "react-dom", "@tanstack/react-router", "@tanstack/react-store"],
  },
  server: {
    host: true,
    port: Number(process.env["PORT"] ?? 8080),
  },
  plugins: [
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tailwindcss(),
    nitro({
      config: {
        preset: process.env["NITRO_PRESET"] ?? "node-server",
      },
    }),
    tanstackStart({
      // Route TanStack Start's server entry through src/server.ts (SSR error wrapper).
      server: { entry: "server" },
    }),
    viteReact(),
  ],
});
