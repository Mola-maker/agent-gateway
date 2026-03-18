// index.js
const express = require('express');
const { fetchNoticesWithAgent } = require('./src/scraper/scraper');

const app = express();
const PORT = 3000;

app.get('/api/notices', async (req, res) => {
    console.log('\n📡 [Gateway] 收到外部硬件终端的数据请求，下达调度指令...');
    
    // 捕获顶层错误，防止网关崩溃
    try {
        const data = await fetchNoticesWithAgent();
        
        // 如果返回的是错误对象，下发 500 状态码
        if (data && data.status === 'error') {
            return res.status(500).json({
                status: 'error',
                timestamp: new Date().toISOString(),
                message: data.message,
                details: data.details
            });
        }

        // 成功，下发给终端极简的高质量数据
        res.json({
            status: 'success',
            timestamp: new Date().toISOString(),
            count: data.length,
            data: data
        });

    } catch (error) {
        console.error('💥 [Gateway] 发生未捕获的致命错误:', error);
        res.status(500).json({
            status: 'error',
            timestamp: new Date().toISOString(),
            message: '网关核心服务崩溃'
        });
    }
});

app.listen(PORT, () => {
    console.log(`
=========================================
🔥 [System] AI Agent 网关已正式上线！
👉 硬件终端 API 地址: http://localhost:${PORT}/api/notices
=========================================
`);
});