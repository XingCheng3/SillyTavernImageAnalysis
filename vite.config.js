import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'

// https://vitejs.dev/config/
export default defineConfig({
    base: './',
    plugins: [
        vue(),
        AutoImport({
            resolvers: [ElementPlusResolver()],
            imports: ['vue', 'vue-router', 'pinia']
        }),
        Components({
            resolvers: [ElementPlusResolver()]
        })
    ],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, 'src')
        }
    },
    server: {
        port: 4321
    },
    publicDir: 'public',
    // 构建配置 - 代码混淆和加密
    build: {
        // 使用 terser 进行代码压缩
        minify: 'terser',
        // terser 压缩选项
        terserOptions: {
            // 压缩选项
            compress: {
                drop_console: true,      // 移除所有 console.log 语句
                drop_debugger: true      // 移除所有 debugger 语句
            },
            // 混淆选项
            mangle: {
                toplevel: true           // 混淆顶层作用域的变量名
            },
            // 格式化选项
            format: {
                comments: false          // 移除所有注释
            }
        }
    }
})