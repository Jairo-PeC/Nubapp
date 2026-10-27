import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base "./" es imprescindible: Streamlit sirve el componente desde una ruta propia dentro de un iframe.
export default defineConfig({
  plugins: [react()],
  base: "./",
  build: { outDir: "dist", emptyOutDir: true },
});
