// vite.config.js

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    // === 添加此配置块 ===
    proxy: {
      // 当请求以 '/api-shortlink' 开头时，启动代理
      '/api-shortlink': {
        // 目标地址是短链接服务的域名
        target: 'https://hzcshortlinklimite.himweiyeah.xyz',
        // 必须配置，将请求头中的 Host 字段改为 target 的域名，以欺骗目标服务器
        changeOrigin: true,
        // 由于目标是 HTTPS，建议设置为 true
        secure: true,
        // 重写路径：将请求路径中的 '/api-shortlink' 移除
        // 这样，本地请求 /api-shortlink/api 就会被转发为 https://hzcshortlink.himweiyeah.xyz/api
        rewrite: (path) => path.replace(/^\/api-shortlink/, '')
      }
    }
    // ==================
  }
})
