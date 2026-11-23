import { defineConfig } from 'vite'
export default defineConfig({
  root: '/root/.claude/skills/stageshow',
  esbuild: { jsx: 'transform', jsxFactory: 'React.createElement', jsxFragment: 'React.Fragment', jsxInject: "import React from 'react'" },
  build: {
    outDir: '/home/user/constiff/hero',
    emptyOutDir: true, target: 'es2020', cssCodeSplit: false,
    lib: { entry: '/root/.claude/skills/stageshow/examples/constiff-hero/site.tsx', formats: ['iife'], name: 'ConstiffHero', fileName: () => 'hero.js' },
    rollupOptions: { external: ['react', 'react-dom', 'react-dom/client'], output: { globals: { react: 'React', 'react-dom': 'ReactDOM', 'react-dom/client': 'ReactDOM' }, assetFileNames: 'hero.[ext]' } },
  },
  define: { 'process.env.NODE_ENV': '"production"' },
})
