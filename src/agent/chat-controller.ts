// src/agent/chat-controller.ts
// 模块E：前台接待员 (Chat Controller)
// 保持运行状态，接收你的提问，去数据库里检索信息，然后回答

import { LightVectorDB } from './vector-db.ts';

export interface ChatResponse {
  answer: string;
  sources: Array<{
    title: string;
    url: string;
    score: number;
  }>;
  confidence: 'high' | 'medium' | 'low';
}

export class ChatController {
  private vectorDB: LightVectorDB;
  private openai: any;

  constructor() {
    this.vectorDB = new LightVectorDB();
  }

  private async getOpenAI() {
    if (!this.openai) {
      const OpenAI = (await import('openai')).default;
      this.openai = new OpenAI({
        baseURL: "https://openrouter.ai/api/v1",
        apiKey: process.env.OPENROUTER_API_KEY,
      });
    }
    return this.openai;
  }

  /**
   * 🛡️ 检查API密钥是否有效
   */
  private isApiKeyValid(): boolean {
    const apiKey = process.env.OPENROUTER_API_KEY;
    return !!(apiKey && apiKey.startsWith('sk-') && apiKey !== 'your_key_here');
  }

  /**
   * 处理用户提问
   */
  async chat(query: string): Promise<ChatResponse> {
    console.log(`💬 [Chat] 收到用户提问: "${query}"`);

    // 1. 从记忆库检索相关信息
    const memories = await this.vectorDB.search(query, 3);

    if (memories.length === 0) {
      return {
        answer: "抱歉，我在记忆库中没有找到相关信息。请先运行爬虫任务收集校园通知数据。",
        sources: [],
        confidence: 'low'
      };
    }

    // 2. 构建上下文
    const context = memories.map((m, i) => 
      `[${i + 1}] 标题: ${m.title}\n内容: ${m.text}\n链接: ${m.url}\n相关度: ${(m.score * 100).toFixed(1)}%`
    ).join('\n\n');

    // 3. 调用LLM生成回答
    try {
      // 🛡️ 检查API密钥是否有效
      if (!this.isApiKeyValid()) {
        console.log(`⚠️ [Chat] API密钥未配置，使用降级模式`);
        throw new Error('API密钥未配置');
      }

      const openai = await this.getOpenAI();
      const response = await openai.chat.completions.create({
        model: process.env.LLM_MODEL || "deepseek/deepseek-chat",
        messages: [
          {
            role: "system",
            content: `你是一个吉林大学校园信息助手。根据提供的校园通知信息，准确回答用户的问题。

规则：
1. 只基于提供的信息回答，不要编造内容
2. 如果信息中包含联系方式、时间、地点等关键信息，一定要提取出来
3. 回答要简洁明了，直接给出用户需要的信息
4. 如果信息不足以回答问题，诚实说明
5. 在回答末尾附上相关链接`
          },
          {
            role: "user",
            content: `用户问题: ${query}\n\n相关校园通知信息:\n${context}`
          }
        ],
        temperature: 0.3,
      });

      const answer = response.choices[0].message.content || "抱歉，我无法生成回答。";

      // 4. 计算置信度
      const avgScore = memories.reduce((sum, m) => sum + m.score, 0) / memories.length;
      const confidence = avgScore > 0.7 ? 'high' : avgScore > 0.4 ? 'medium' : 'low';

      console.log(`💬 [Chat] 回答生成完成，置信度: ${confidence}`);

      return {
        answer,
        sources: memories.map(m => ({
          title: m.title,
          url: m.url,
          score: m.score
        })),
        confidence
      };

    } catch (error: any) {
      console.error(`❌ [Chat] LLM调用失败:`, error.message);
      
      // 降级方案：直接返回检索结果
      const fallbackAnswer = memories.map(m => 
        `📌 ${m.title}\n${m.text}\n🔗 ${m.url}`
      ).join('\n\n');

      return {
        answer: `（AI生成失败，以下是检索到的相关信息）\n\n${fallbackAnswer}`,
        sources: memories.map(m => ({
          title: m.title,
          url: m.url,
          score: m.score
        })),
        confidence: 'low'
      };
    }
  }

  /**
   * 获取记忆库统计信息
   */
  getStats() {
    return this.vectorDB.getStats();
  }

  /**
   * 获取所有记忆列表
   */
  getAllMemories() {
    return this.vectorDB.getAllMemories();
  }

  /**
   * 清空记忆库
   */
  clearMemory() {
    this.vectorDB.clearMemory();
  }
}