import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

// Branch-aware Supabase target resolver
// eslint-disable-next-line @typescript-eslint/no-require-imports
import { resolveSupabaseTarget } from './supabase-target.mjs';

const supabaseEnv = resolveSupabaseTarget();

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  define: {
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(supabaseEnv.url),
    'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(supabaseEnv.anonKey),
    'import.meta.env.VITE_SUPABASE_ENV': JSON.stringify(supabaseEnv.env),
  },
  server: {
    port: 3001,
    strictPort: true,
  },
  build: {
    sourcemap: true,
  },
});
