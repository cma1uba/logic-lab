import { defineConfig } from 'vite'
import { copyFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const rootDirectory = dirname(fileURLToPath(import.meta.url))

const copyExtensionServiceWorker = () => ({
  name: 'copy-extension-service-worker',
  writeBundle(outputOptions) {
    const outputDirectory = outputOptions.dir ?? 'dist'
    copyFileSync(
      resolve(rootDirectory, 'background.js'),
      resolve(rootDirectory, outputDirectory, 'background.js'),
    )
  },
})

// https://vite.dev/config/
export default defineConfig({
  root: rootDirectory,
  build: {
    outDir: resolve(rootDirectory, 'dist'),
    emptyOutDir: true,
  },
  plugins: [
    react(),
    tailwindcss(),
    copyExtensionServiceWorker(),
  ],
})
