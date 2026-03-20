// index.js - JLU Agent Gateway 主入口（硅谷级架构）
import 'dotenv/config';
import express from 'express';
import readline from 'readline';
import { createJLUAgentTool } from './src/agent/agent-tool.ts';

const app = express();
app.use(express.json());

// 初始化我们的"工具化"Agent
const jluTool = createJLUAgentTool();

// 维护一个全局意图状态
let currentUserIntent = "最近的所有校内通知";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function startTerminalUI() {
  console.log('\n' + '='.repeat(50));
  console.log('🤖 JLU Agent 网关交互控制台 v2.0');
  console.log('当前监控意图: ' + currentUserIntent);
  console.log('='.repeat(50));
  console.log('可用命令:');
  console.log('  - 输入新意图更新监控目标');
  console.log('  - "chat <问题>" 进行对话查询');
  console.log('  - "stats" 查看记忆统计');
  console.log('  - "memories" 查看所有记忆');
  console.log('  - "clear" 清空记忆');
  console.log('  - "exit" 退出');
  console.log('='.repeat(50));
  
  rl.question('请输入指令 > ', async (input) => {
    if (input.toLowerCase() === 'exit') {
      process.exit(0);
    }
    
    if (input.toLowerCase() === 'stats') {
      const result = await jluTool.execute({ action: 'stats' });
      console.log('📊 记忆统计:', result.data);
      startTerminalUI();
      return;
    }
    
    if (input.toLowerCase() === 'memories') {
      const result = await jluTool.execute({ action: 'memories' });
      console.log('💾 所有记忆:', result.data);
      startTerminalUI();
      return;
    }
    
    if (input.toLowerCase() === 'clear') {
      const result = await jluTool.execute({ action: 'clear' });
      console.log('🗑️', result.message);
      startTerminalUI();
      return;
    }
    
    if (input.toLowerCase().startsWith('chat ')) {
      const query = input.substring(5);
      console.log(`💬 正在查询: "${query}"`);
      const result = await jluTool.execute({ action: 'chat', query });
      console.log('\n📝 回答:');
      console.log(result.data.answer);
      console.log('\n🔗 来源:', result.data.sources.map(s => s.title).join(', '));
      console.log('📊 置信度:', result.data.confidence);
      startTerminalUI();
      return;
    }
    
    if (input.trim()) {
      currentUserIntent = input.trim();
      console.log(`✅ 意图已更新为: "${currentUserIntent}"`);
      console.log('💡 下次访问 /api/notices 将使用新意图');
    }
    startTerminalUI();
  });
}

// 首页
app.get('/', (req, res) => {
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  res.send(`
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>JLU Agent 网关 v2.0</title>
      <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        h1 { color: #333; }
        ul { list-style-type: none; padding: 0; }
        li { margin: 10px 0; padding: 10px; background: #f5f5f5; border-radius: 5px; }
        a { color: #0066cc; text-decoration: none; }
        a:hover { text-decoration: underline; }
        .method { font-weight: bold; color: #666; }
      </style>
    </head>
    <body>
      <h1>🤖 JLU Agent 网关 v2.0</h1>
      <p>硅谷级架构 - 5大模块协同工作</p>
      <h2>可用接口:</h2>
      <ul>
        <li><a href="${baseUrl}/api/notices">/api/notices</a> <span class="method">GET</span> - 获取校园通知（全自动流水线）</li>
        <li><a href="${baseUrl}/api/stats">/api/stats</a> <span class="method">GET</span> - 记忆统计</li>
        <li><a href="${baseUrl}/api/memories">/api/memories</a> <span class="method">GET</span> - 所有记忆</li>
        <li><a href="${baseUrl}/api/scout">/api/scout</a> <span class="method">GET</span> - 探路任务</li>
        <li><span class="method">POST</span> /api/chat - 对话查询 (需要JSON body: {"query": "问题"})</li>
        <li><span class="method">POST</span> /api/parse - 解析文件 (需要JSON body: {"filePath": "路径"})</li>
      </ul>
      <h2>使用说明:</h2>
      <p>点击 GET 链接可直接在浏览器中测试。</p>
      <p>POST 接口需要使用 curl 或 Postman 等工具发送 JSON 请求。</p>
    </body>
    </html>
  `);
});

/**
 * 模块A+B：全自动流水线接口
 */
app.get('/api/notices', async (req, res) => {
  console.log(`\n📡 [API Request] 收到请求，启动全自动流水线...`);
  console.log(`🎯 当前意图: ${currentUserIntent}`);
  
  const result = await jluTool.execute({
    action: "pipeline",
    intent: currentUserIntent
  });

  if (result.status === 'success') {
    res.json({
      status: 'ok',
      intent: currentUserIntent,
      count: result.data.length,
      data: result.data
    });
  } else {
    res.status(500).json(result);
  }
});

/**
 * 模块E：对话查询接口
 */
app.post('/api/chat', async (req, res) => {
  const { query } = req.body;
  
  if (!query) {
    return res.status(400).json({ error: '缺少 query 参数' });
  }
  
  console.log(`💬 [API Request] 对话查询: "${query}"`);
  
  const result = await jluTool.execute({
    action: "chat",
    query
  });

  res.json(result);
});

/**
 * 获取记忆统计
 */
app.get('/api/stats', async (req, res) => {
  const result = await jluTool.execute({ action: 'stats' });
  res.json(result);
});

/**
 * 获取所有记忆
 */
app.get('/api/memories', async (req, res) => {
  const result = await jluTool.execute({ action: 'memories' });
  res.json(result);
});

/**
 * 模块C：文件解析接口
 */
app.post('/api/parse', async (req, res) => {
  const { filePath } = req.body;
  
  if (!filePath) {
    return res.status(400).json({ error: '缺少 filePath 参数' });
  }
  
  console.log(`📄 [API Request] 文件解析: ${filePath}`);
  
  const result = await jluTool.execute({
    action: "parse",
    filePath
  });

  res.json(result);
});

/**
 * 探路接口
 */
app.get('/api/scout', async (req, res) => {
  console.log(`🔍 [API Request] 探路任务...`);
  
  const result = await jluTool.execute({
    action: "scout"
  });

  res.json(result);
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`\n🚀 [System] JLU Agent Gateway v2.0 已上线！`);
  console.log(`📍 访问地址: http://localhost:${PORT}`);
  console.log(`\n🏗️ 架构模块:`);
  console.log(`  ✅ 模块A: 探路者 (Scraper Agent)`);
  console.log(`  ✅ 模块B: 潜水员 (Deep-Dive Agent)`);
  console.log(`  ✅ 模块C: 文件粉碎机 (Document Parser)`);
  console.log(`  ✅ 模块D: 记忆中枢 (Vector DB)`);
  console.log(`  ✅ 模块E: 前台接待员 (Chat Controller)`);
  console.log(`\n`);
  startTerminalUI();
});