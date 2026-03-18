// src/agent/agent-tool.schema.ts
import { Type } from "@sinclair/typebox";

export const AGENT_ACTIONS = ["scout", "dive", "summarize"] as const;

export const AgentToolSchema = Type.Object({
  action: Type.String({ 
    description: "执行动作：scout(寻路获取列表), dive(深入阅读), summarize(提炼摘要)" 
  }),
  targetUrl: Type.Optional(Type.String({ description: "目标网址" })),
  intent: Type.Optional(Type.String({ description: "用户搜索意图" })),
  links: Type.Optional(Type.Array(Type.String(), { description: "dive 动作需要的链接列表" })),
  content: Type.Optional(Type.String({ description: "待提炼的正文" })),
});