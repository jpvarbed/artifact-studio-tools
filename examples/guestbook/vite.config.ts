import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base: "./" → relative asset paths in the built index.html, so it works served from the app's origin root.
export default defineConfig({
  plugins: [react()],
  base: "./",
});
