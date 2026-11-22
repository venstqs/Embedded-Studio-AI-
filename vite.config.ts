import { execSync } from 'node:child_process'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/** The commit this build came from, shown in Settings → About like the XavierLabs site footer. */
function build() {
  let hash = 'dev'
  try { hash = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() } catch { /* not a git checkout */ }
  return { hash, date: new Date().toISOString().slice(0, 10) }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/Embedded-Studio-AI-/',
  define: { __BUILD__: JSON.stringify(build()) },
})
