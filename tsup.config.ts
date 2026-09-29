import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  outDir: 'dist',
  splitting: false,
  sourcemap: false,
  clean: true,
  dts: false,
  tsconfig: 'tsconfig.json',
})
