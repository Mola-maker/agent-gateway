// src/agent/agent-tool.ts
import OpenAI from 'openai';
import { chromium } from 'playwright';
import { AgentToolSchema } from './agent-tool.schema.js';
import { 
    executeScoutAction, 
    executeDiveAction, 
    executePipelineAction 
} from './agent-tool.actions.js';

export function createJLUAgentTool() {
    return {
        name: "jlu_agent_gateway",
        description: "吉林大学校务情报 Agent，支持寻路、深度提取与全自动任务。",
        parameters: AgentToolSchema,
        execute: async (args: any) => {
            const { action, intent, targetUrl, links } = args;
            const openai = new OpenAI({
                baseURL: "https://openrouter.ai/api/v1",
                apiKey: process.env.OPENROUTER_API_KEY,
            });

            const browser = await chromium.launch({ headless: false, channel: 'msedge' });
            
            try {
                switch (action) {
                    case "scout":
                        const page = await browser.newPage();
                        const list = await executeScoutAction(page, openai, targetUrl || process.env.TARGET_URL!);
                        return { status: "success", data: list };
                    
                    case "dive":
                        if (!links || links.length === 0) throw new Error("dive 动作需要 links 参数");
                        const content = await executeDiveAction(browser, links[0]);
                        return { status: "success", data: content };

                    case "pipeline":
                        const reports = await executePipelineAction(browser, openai, intent || "最新通知");
                        return { status: "success", data: reports };

                    default:
                        throw new Error(`未知动作: ${action}`);
                }
            } catch (error: any) {
                return { status: "error", message: error.message };
            } finally {
                await browser.close();
            }
        }
    };
}