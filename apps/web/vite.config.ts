import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// `base: "./"` keeps built asset URLs relative, so the site works whether
// it's served from a GitHub Pages project subpath or the repo root.
export default defineConfig({
  plugins: [react()],
  base: "./",
});
