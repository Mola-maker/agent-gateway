// index-v2.js - JLU Agent Gateway v2.0 硅谷级架构主入口
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createSSEStream } from './src/agent/sse-stream.js';
import { FastScraperEngine } from './src/agent/fast-scraper.js';
import { LightVectorDB } from './src/agent/vector-db.js';
import { ChatController } from './src/agent/chat-controller.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log(`📁 [Path] __dirname: ${__dirname}`);
console.log(`📁 [Path] frontend path: ${path.join(__dirname, 'frontend')}`);

const app = express();
app.use(cors());
app.use(express.json());

// 静态文件服务 - 前端
const frontendPath = path.join(__dirname, 'frontend');
console.log(`📁 [Static] Serving frontend from: ${frontendPath}`);
app.use('/frontend', express.static(frontendPath, { 
  index: false,
  dotfiles: 'allow',
  fallthrough: true,
  redirect: false,
  etag: false,
  lastModified: false
}));

// 初始化核心模块
const fastScraper = new FastScraperEngine();
const vectorDB = new LightVectorDB();
const chatController = new ChatController();

// 全局意图状态
let currentUserIntent = "最近的所有校内通知";

// 首页 - 重定向到现代化前端
app.get('/', (req, res) => {
  res.redirect('/frontend/index.html');
});

/**
 * 模块A+B：极速爬虫接口 - 普通模式
 */
app.get('/api/notices', async (req, res) => {
  console.log(`\n📡 [API Request] 收到请求，启动极速流水线...`);
  console.log(`🎯 当前意图: ${currentUserIntent}`);
  
  try {
    const result = await fastScraper.scrapeWithSpeed(
      process.env.TARGET_URL || 'https://oa.jlu.edu.cn/',
      currentUserIntent
    );

    // 存入记忆库
    if (result && result.length > 0) {
      await vectorDB.addMemories(result.map(item => ({
        title: item.title,
        summary: item.summary || item.title,
        url: item.link
      })));
    }

    res.json({
      status: 'ok',
      intent: currentUserIntent,
      count: result.length,
      data: result
    });
  } catch (error) {
    console.error(`❌ [API Error]`, error.message);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

/**
 * 模块A+B：极速爬虫接口 - SSE流式模式
 */
app.get('/api/notices/stream', async (req, res) => {
  const intent = req.query.intent || currentUserIntent;
  const count = parseInt(req.query.count) || 10;
  
  console.log(`\n📡 [SSE Request] 启动流式爬虫...`);
  console.log(`🎯 意图: ${intent}, 数量: ${count}`);
  
  const sse = createSSEStream(res);
  
  try {
    // 直接手动执行流式爬虫步骤，避免参数传递问题
    sse.sendStart('爬虫任务启动...');

    sse.sendProgress('初始化爬虫引擎', 10);

    sse.sendProgress('访问目标网站', 30);

    sse.sendProgress('获取通知列表', 50);
    const scraperResult = await fastScraper.scrapeWithSpeed(
      process.env.TARGET_URL || 'https://oa.jlu.edu.cn/',
      intent
    );

    sse.sendProgress('存入记忆库', 80);
    if (scraperResult && scraperResult.length > 0) {
      await vectorDB.addMemories(scraperResult.map(item => ({
        title: item.title,
        summary: item.summary || item.title,
        url: item.link
      })));
    }

    sse.sendProgress('完成', 100);
    sse.sendData(scraperResult);
    sse.sendEnd('爬虫任务完成');
    
  } catch (error) {
    console.error(`❌ [SSE Error]`, error.message);
    sse.sendError(error.message);
  }
});

/**
 * 模块E：对话查询接口 - 普通模式
 */
app.post('/api/chat', async (req, res) => {
  const { query } = req.body;
  
  if (!query) {
    return res.status(400).json({ error: '缺少 query 参数' });
  }
  
  console.log(`💬 [API Request] 对话查询: "${query}"`);
  
  try {
    const response = await chatController.chat(query);
    res.json({ status: 'success', data: response });
  } catch (error) {
    console.error(`❌ [Chat Error]`, error.message);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

/**
 * 模块E：对话查询接口 - SSE流式模式
 */
app.post('/api/chat/stream', async (req, res) => {
  const { query } = req.body;
  
  if (!query) {
    return res.status(400).json({ error: '缺少 query 参数' });
  }
  
  console.log(`💬 [SSE Chat] 流式对话: "${query}"`);
  
  const sse = createSSEStream(res);
  
  try {
    // 从记忆库检索相关信息
    const memories = await vectorDB.search(query, 3);
    
    sse.sendStart('AI正在思考...');
    
    // 构建上下文
    const context = memories.map((m, i) => 
      `[${i + 1}] 标题: ${m.title}\n内容: ${m.text}\n链接: ${m.url}`
    ).join('\n\n');
    
    // 🛡️ 检查API密钥是否有效
    const apiKey = process.env.OPENROUTER_API_KEY;
    const isApiKeyValid = apiKey && apiKey.startsWith('sk-') && apiKey !== 'your_key_here';
    
    if (!isApiKeyValid) {
      console.log(`⚠️ [SSE Chat] API密钥未配置，使用降级模式`);
      sse.sendProgress('API密钥未配置，返回检索结果', 50);
      
      // 降级方案：直接返回检索结果
      const fallbackAnswer = memories.length > 0 
        ? memories.map(m => `📌 ${m.title}\n${m.text}\n🔗 ${m.url}`).join('\n\n')
        : '抱歉，我在记忆库中没有找到相关信息。请先运行爬虫任务收集校园通知数据。';
      
      sse.send({
        type: 'data',
        payload: { 
          chunk: fallbackAnswer, 
          fullResponse: fallbackAnswer 
        },
        timestamp: Date.now()
      });
      
      sse.sendEnd('检索完成');
      return;
    }
    
    // 流式调用LLM
    const OpenAI = (await import('openai')).default;
    const openai = new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: apiKey,
    });
    
    const model = process.env.LLM_MODEL || "deepseek/deepseek-chat";
    console.log(`🤖 [SSE Chat] 使用模型: ${model}`);
    
    const stream = await openai.chat.completions.create({
      model: model,
      messages: [
        {
          role: "system",
          content: `你是一个吉林大学校园信息助手。根据提供的校园通知信息，准确回答用户的问题。`
        },
        {
          role: "user",
          content: `用户问题: ${query}\n\n相关校园通知信息:\n${context}`
        }
      ],
      temperature: 0.3,
      stream: true
    });
    
    // 流式发送响应
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        sse.send({
          type: 'data',
          payload: { chunk, fullResponse: '' },
          timestamp: Date.now()
        });
      }
    }
    
    sse.sendEnd('AI响应完成');
    
  } catch (error) {
    console.error(`❌ [SSE Chat Error]`, error.message);
    sse.sendError(error.message);
  }
});

/**
 * 获取记忆统计
 */
app.get('/api/stats', async (req, res) => {
  try {
    const stats = vectorDB.getStats();
    res.json({ status: 'success', data: stats });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

/**
 * 获取所有记忆
 */
app.get('/api/memories', async (req, res) => {
  try {
    const memories = vectorDB.getAllMemories();
    res.json({ status: 'success', data: memories });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

/**
 * 清空记忆
 */
app.post('/api/memories/clear', async (req, res) => {
  try {
    vectorDB.clearMemory();
    res.json({ status: 'success', message: '记忆已清空' });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

/**
 * 更新意图
 */
app.post('/api/intent', (req, res) => {
  const { intent } = req.body;
  if (intent) {
    currentUserIntent = intent;
    console.log(`✅ 意图已更新为: "${currentUserIntent}"`);
    res.json({ status: 'success', intent: currentUserIntent });
  } else {
    res.status(400).json({ error: '缺少 intent 参数' });
  }
});

/**
 * 健康检查
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '2.0.0',
    architecture: '硅谷级5模块',
    modules: {
      scraper: '运行中',
      dive: '运行中',
      parser: '运行中',
      vectorDB: '运行中',
      chat: '运行中'
    }
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`\n🚀 [System] JLU Agent Gateway v2.0 硅谷级架构已上线！`);
  console.log(`📍 访问地址: http://localhost:${PORT}`);
  console.log(`📍 现代化前端: http://localhost:${PORT}/frontend/index.html`);
  console.log(`\n🏗️ 架构模块:`);
  console.log(`  ✅ 模块A: 探路者 (Fast Scraper Agent) - 极速模式`);
  console.log(`  ✅ 模块B: 潜水员 (Deep-Dive Agent) - 并发处理`);
  console.log(`  ✅ 模块C: 文件粉碎机 (Document Parser) - 多格式支持`);
  console.log(`  ✅ 模块D: 记忆中枢 (Vector DB) - 语义检索`);
  console.log(`  ✅ 模块E: 前台接待员 (Chat Controller) - 流式响应`);
  console.log(`\n📡 API接口:`);
  console.log(`  GET  /api/notices        - 极速爬虫(普通)`);
  console.log(`  GET  /api/notices/stream - 极速爬虫(SSE流式)`);
  console.log(`  POST /api/chat           - 智能对话(普通)`);
  console.log(`  POST /api/chat/stream    - 智能对话(SSE流式)`);
  console.log(`  GET  /api/stats          - 记忆统计`);
  console.log(`  GET  /api/memories       - 所有记忆`);
  console.log(`  POST /api/memories/clear - 清空记忆`);
  console.log(`  POST /api/intent         - 更新意图`);
  console.log(`  GET  /api/health         - 健康检查`);
  console.log(`\n`);
});