// 文件路径: [Project Root]/functions/api-shortlink/api.js

/**
 * Pages Function 代理，将请求从 /api-shortlink/api 转发到 Worker 的 /api
 *
 * @param {EventContext} context Pages Function 的上下文对象
 * @returns {Response} 目标 Worker 的响应
 */
export async function onRequest(context) {
    // 目标 Worker 的根域名
    const workerUrlRoot = 'https://hzcshortlinklimite.himweiyeah.xyz';

    // Pages 收到 /api-shortlink/api，目标 Worker 只需要 /api
    const targetPath = '/api';

    const url = new URL(workerUrlRoot + targetPath);

    const request = context.request;

    try {
        // 使用 fetch() 发起对目标 Worker 的代理请求
        const response = await fetch(url.toString(), {
            method: request.method, // 转发请求方法 (POST)
            headers: request.headers, // 转发所有请求头 (包括 Content-Type)
            body: request.body, // 转发请求体 (用于 POST 请求)
        });

        // 将 Worker 的响应（包括状态码、头部和内容）返回给前端
        return response;
    } catch (e) {
        // 如果代理过程中出现错误（例如 Worker 不可达），返回 500
        return new Response(`Proxy Error: Failed to reach Worker - ${e.message}`, {
            status: 500,
            headers: { 'Content-Type': 'text/plain' }
        });
    }
}
