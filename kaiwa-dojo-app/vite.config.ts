import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  base: '/',

  plugins: [
    tailwindcss(),
    react(),
    babel({ presets: [reactCompilerPreset()] }),
  ],
  build: {
    // Vite 8 menggunakan OXC/rolldown sebagai default minifier — lebih cepat dari esbuild
    // Tidak perlu set minify secara eksplisit, biarkan Vite memilih yang optimal

    // Inline assets < 4KB langsung ke JS/CSS (kurangi round-trip HTTP)
    assetsInlineLimit: 4096,

    // Split CSS per chunk untuk lazy-load yang lebih efisien
    cssCodeSplit: true,

    // Jangan hitung compressed size saat build — mempercepat proses build
    reportCompressedSize: false,

    // Naikkan batas warning (halaman besar seperti LearningPlan memang besar)
    chunkSizeWarningLimit: 900,

    rollupOptions: {
      output: {
        // Granular chunk splitting untuk optimal caching & parallel load
        manualChunks(id) {
          if (id.includes('node_modules')) {
            // Supabase — sering di-update, pisahkan agar cache lebih persisten
            if (id.includes('@supabase')) return 'vendor-supabase'

            // Icon set — besar tapi jarang berubah
            if (id.includes('lucide-react')) return 'vendor-icons'

            // Chart.js — hanya dipakai di dashboard, lazy-chunk terpisah
            if (id.includes('chart.js') || id.includes('chart')) return 'vendor-chart'

            // Canvas confetti — dipakai saat event, chunk kecil terpisah
            if (id.includes('canvas-confetti')) return 'vendor-confetti'

            // React core — cache lama, sangat jarang berubah
            if (id.includes('react-dom')) return 'vendor-react-dom'
            if (id.includes('react-router')) return 'vendor-react-router'
            if (id.includes('/react/') || id.includes('/react@')) return 'vendor-react'

            // Sisa node_modules lainnya
            return 'vendor-utils'
          }
        },

        // Format nama chunk yang stabil untuk caching jangka panjang
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },

  // Optimasi dev server (tidak mempengaruhi production build)
  server: {
    warmup: {
      // Pre-bundle file yang paling sering diimport untuk cold start lebih cepat
      clientFiles: [
        './src/App.tsx',
        './src/hooks/useAuth.tsx',
        './src/lib/supabaseClient.ts',
      ],
    },
  },
})
