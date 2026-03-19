// src/agent/agent-tool.schema.ts
import { Type } from "@sinclair/typebox";

export const AGENT_ACTIONS = ["scout", "dive", "pipeline", "chat", "parse"] as const;

export const AgentToolSchema = Type.Object({
  action: Type.String({ 
    description: "执行动作：scout(寻路获取列表), dive(深入阅读), pipeline(全自动任务), chat(对话查询), parse(文件解析)" 
  }),
  targetUrl: Type.Optional(Type.String({ description: "目标网址" })),
  intent: Type.Optional(Type.String({ description: "用户搜索意图" })),
  links: Type.Optional(Type.Array(Type.String(), { description: "dive 动作需要的链接列表" })),
  content: Type.Optional(Type.String({ description: "待提炼的正文" })),
  query: Type.Optional(Type.String({ description: "chat动作的查询内容" })),
  filePath: Type.Optional(Type.String({ description: "parse动作的文件路径" })),
});