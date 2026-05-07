// src/agent/agent-tool.ts
// JLU Agent Gateway - 主工具类（硅谷级架构）

import OpenAI from 'openai';
import playwright from 'playwright';
const { chromium } = playwright;
import { AgentToolSchema } from './agent-tool.schema.ts';
import { 
  executeScoutAction, 
  executeDiveAction, 
  executePipelineAction,
  executeParseAction
} from './agent-tool.actions.ts';
import { LightVectorDB } from './vector-db.ts';
import { ChatController } from './chat-controller.ts';

export function createJLUAgentTool() {
  const vectorDB = new LightVectorDB();
  const chatController = new ChatController();
  
  return {
    name: "jlu_agent_gateway",
    description: "吉林大学校务情报 Agent，支持寻路、深度提取、全自动任务、对话查询和文件解析。",
    parameters: AgentToolSchema,
    execute: async (args: any) => {
      const { action, intent, targetUrl, links, query, filePath } = args;
      const openai = new OpenAI({
        baseURL: "https://openrouter.ai/api/v1",
        apiKey: process.env.OPENROUTER_API_KEY,
      });

      try {
        switch (action) {
          // 模块A：探路者
          case "scout":
            console.log(`🔍 [Agent] 执行探路任务...`);
            const browser1 = await chromium.launch({ headless: false, channel: 'msedge' });
            try {
              const page = await browser1.newPage();
              const list = await executeScoutAction(page, openai, targetUrl || process.env.TARGET_URL!);
              return { status: "success", data: list };
            } finally {
              await browser1.close();
            }
          
          // 模块B：潜水员
          case "dive":
            console.log(`🏊 [Agent] 执行潜水任务...`);
            if (!links || links.length === 0) throw new Error("dive 动作需要 links 参数");
            const browser2 = await chromium.launch({ headless: false, channel: 'msedge' });
            try {
              const content = await executeDiveAction(browser2, links[0]);
              return { status: "success", data: content };
            } finally {
              await browser2.close();
            }

          // 模块A+B：全自动流水线
          case "pipeline":
            console.log(`🚀 [Agent] 执行全自动流水线...`);
            const browser3 = await chromium.launch({ headless: false, channel: 'msedge' });
            try {
              const reports = await executePipelineAction(browser3, openai, intent || "最新通知", vectorDB);
              return { status: "success", data: reports };
            } finally {
              await browser3.close();
            }

          // 模块C：文件解析
          case "parse":
            console.log(`📄 [Agent] 执行文件解析...`);
            if (!filePath) throw new Error("parse 动作需要 filePath 参数");
            const parsed = await executeParseAction(filePath);
            return { status: "success", data: parsed };

          // 模块D：直接语义检索（无LLM生成）
          case "search":
            console.log(`🔍 [Agent] 执行语义检索...`);
            if (!query) throw new Error("search 动作需要 query 参数");
            const topK = args.topK ?? 5;
            const searchResults = await vectorDB.search(query, topK);
            return { status: "success", data: searchResults };

          // 模块E：对话查询
          case "chat":
            console.log(`💬 [Agent] 执行对话查询...`);
            if (!query) throw new Error("chat 动作需要 query 参数");
            const response = await chatController.chat(query);
            return { status: "success", data: response };

          // 获取记忆统计
          case "stats":
            console.log(`📊 [Agent] 获取记忆统计...`);
            const stats = chatController.getStats();
            return { status: "success", data: stats };

          // 获取所有记忆
          case "memories":
            console.log(`💾 [Agent] 获取所有记忆...`);
            const memories = chatController.getAllMemories();
            return { status: "success", data: memories };

          // 清空记忆
          case "clear":
            console.log(`🗑️ [Agent] 清空记忆...`);
            chatController.clearMemory();
            return { status: "success", message: "记忆已清空" };

          default:
            throw new Error(`未知动作: ${action}。支持的动作: scout, dive, pipeline, parse, chat, stats, memories, clear`);
        }
      } catch (error: any) {
        console.error(`❌ [Agent] 执行失败:`, error.message);
        return { status: "error", message: error.message };
      }
    }
  };
}