import { defineConfig } from 'vite'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  base: '/aptos-2048/',
  plugins: [tsconfigPaths()]
})
