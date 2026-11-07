import { defineConfig } from "vite";

export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("/node_modules/") && /\/(?:@icp-sdk|@noble|@scure|@dfinity)\//.test(id)) {
            return "icp";
          }
        },
      },
    },
  },
});
