// index.js
require('dotenv').config();
const express = require('express');
const readline = require('readline');
const { createJLUAgentTool } = require('./src/agent/agent-tool');

const app = express();
const PORT = 3000;

// 初始化我们的“工具化”Agent
const jluTool = createJLUAgentTool();

// 维护一个全局意图状态
let currentUserIntent = "最近的所有校内通知";

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function startTerminalUI() {
    console.log('\n' + '='.repeat(40));
    console.log('🤖 JLU Agent 网关交互控制台');
    console.log('当前监控意图: ' + currentUserIntent);
    console.log('='.repeat(40));
    
    rl.question('请输入您的新指令 (输入 "exit" 退出) > ', (input) => {
        if (input.toLowerCase() === 'exit') {
            process.exit(0);
        }
        if (input.trim()) {
            currentUserIntent = input.trim();
            console.log(`✅ 意图已更新，终端请求将触发深度探测...`);
        }
        startTerminalUI();
    });
}

/**
 * 响应硬件终端的极简接口
 */
app.get('/api/notices', async (req, res) => {
    console.log(`\n📡 [API Request] 收到硬件终端信号，启动自动执行链...`);
    
    // 调用我们的工业级工具，只需传入 action 和意图
    const result = await jluTool.execute({
        action: "pipeline", // 我们新定义的“全自动”动作
        intent: currentUserIntent
    });

    if (result.status === 'success') {
        res.json({
            status: 'ok',
            intent: currentUserIntent,
            data: result.data
        });
    } else {
        res.status(500).json(result);
    }
});

app.listen(PORT, () => {
    console.log(`🚀 [System] 后端服务已挂载于 http://localhost:${PORT}`);
    startTerminalUI();
});