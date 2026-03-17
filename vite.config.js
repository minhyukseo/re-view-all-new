import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
    root: 'web', // 프로젝트 루트를 web 폴더로 지정
    base: '/',
    build: {
        outDir: '../dist', // 빌드 결과물은 프로젝트 루트의 dist 폴더로
        rollupOptions: {
            input: {
                root: resolve(__dirname, 'web/index.html'),
                main: resolve(__dirname, 'web/overview/index.html'),
                dashboard: resolve(__dirname, 'web/overview/dashboard/index.html'),
                list: resolve(__dirname, 'web/overview/list/index.html'),
                movPlayer: resolve(__dirname, 'web/overview/movPlayer/index.html'),
                videoExtract: resolve(__dirname, 'web/overview/videoExtract/index.html'),
                notice: resolve(__dirname, 'web/overview/notice/index.html'),
                tips: resolve(__dirname, 'web/overview/tips/index.html'),
                privacy: resolve(__dirname, 'web/overview/privacy/index.html'),
                terms: resolve(__dirname, 'web/overview/terms/index.html'),
                cookies: resolve(__dirname, 'web/overview/cookies/index.html'),
                disclaimer: resolve(__dirname, 'web/overview/disclaimer/index.html'),
                copyright: resolve(__dirname, 'web/overview/copyright/index.html'),
                aboutus: resolve(__dirname, 'web/overview/aboutus/index.html'),
                contactus: resolve(__dirname, 'web/overview/contactus/index.html'),
            },
            output: {
                chunkFileNames: 'assets/js/[name]-[hash].js',
                entryFileNames: 'assets/js/[name]-[hash].js',
                assetFileNames: 'assets/[ext]/[name]-[hash].[ext]',
                manualChunks(id) {
                    if (id.includes('node_modules')) {
                        return 'vendor';
                    }
                }
            }
        },
        minify: 'terser',
        terserOptions: {
            compress: {
                drop_console: true,
                drop_debugger: true,
            },
        },
        sourcemap: false,
    },
    server: {
        port: 5173,
        open: true,
        proxy: {
            '/api': 'http://localhost:3000', // 기존 백엔드 서버 연동
        }
    },
    publicDir: 'public',
});
