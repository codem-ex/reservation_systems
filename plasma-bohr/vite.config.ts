import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],

  server: {
    allowedHosts: [
      "faye-proracing-intriguedly.ngrok-free.dev",
    ],
  },
});
