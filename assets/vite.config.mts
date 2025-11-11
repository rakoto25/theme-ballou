import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
    plugins: [react()],
    root: __dirname, // on build depuis /assets
    base: "",
    define: {
        global: "globalThis",  // ← FIX : Compat Leaflet global (window.L pour react-leaflet)
    },
    optimizeDeps: {
        include: [
            "leaflet",       // ← FIX : Pré-optimise Leaflet pour dynamic import stable
            "react-leaflet"  // ← FIX : Évite undefined exports (core composants comme MapContainer)
        ],
    },
    build: {
        outDir: path.resolve(__dirname, "dist"),
        emptyOutDir: true,
        manifest: true,
        rollupOptions: {
            input: path.resolve(__dirname, "src", "main.tsx"), // ← pas d'index.html
        },
    },
});