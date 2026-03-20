// src/agent/vector-db.ts
// 模块D：记忆中枢 (Vector DB / 向量数据库)
// 把爬下来的正文和表格数据，切片存入本地数据库

import fs from 'fs';
import path from 'path';

// 我们在本地存一个微型 JSON 数据库
const DB_PATH = './jlu_memory.json';

interface MemoryRecord {
  id: string;
  text: string;
  url: string;
  title: string;
  timestamp: number;
  vector?: number[];
}

export class LightVectorDB {
  private records: MemoryRecord[] = [];
  private openai: any;

  constructor() {
    this.load();
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

  // 🛡️ 检查API密钥是否有效
  private isApiKeyValid(): boolean {
    const apiKey = process.env.OPENROUTER_API_KEY;
    return !!(apiKey && apiKey.startsWith('sk-') && apiKey !== 'your_key_here');
  }

  // 调用嵌入模型将文字转化为多维向量
  async getEmbedding(text: string): Promise<number[]> {
    // 🛡️ 检查API密钥
    if (!this.isApiKeyValid()) {
      console.log(`⚠️ [Embedding] API密钥未配置，跳过向量编码`);
      return [];
    }

    try {
      console.log(`🧬 [Embedding] 正在将文本编码为高维向量...`);
      const openai = await this.getOpenAI();
      // 使用 OpenRouter 支持的嵌入模型
      const response = await openai.embeddings.create({
        model: "openai/text-embedding-ada-002",
        input: text.substring(0, 8000), // 限制长度
      });
      return response.data[0].embedding;
    } catch (error: any) {
      console.warn(`⚠️ [Embedding] 向量编码失败，使用降级方案:`, error.message);
      // 降级方案：返回空向量，将使用文本匹配
      return [];
    }
  }

  // 存入记忆中枢
  async addMemory(title: string, summary: string, url: string) {
    const fullText = `标题：${title}\n摘要：${summary}`;
    
    // 防止重复存入
    if (this.records.some(r => r.url === url)) {
      console.log(`💾 [Memory] 记录已存在，跳过: ${title}`);
      return;
    }

    const vector = await this.getEmbedding(fullText);
    
    this.records.push({
      id: Date.now().toString(),
      text: fullText,
      url,
      title,
      timestamp: Date.now(),
      vector: vector.length > 0 ? vector : undefined
    });
    
    this.save();
    console.log(`💾 [Memory] 已将《${title}》存入记忆中枢。`);
  }

  // 批量存入记忆
  async addMemories(items: Array<{ title: string; summary: string; url: string }>) {
    console.log(`💾 [Memory] 批量存入 ${items.length} 条记忆...`);
    for (const item of items) {
      await this.addMemory(item.title, item.summary, item.url);
    }
  }

  // 余弦相似度计算核心数学逻辑
  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length === 0 || vecB.length === 0) return 0;
    
    let dotProduct = 0, normA = 0, normB = 0;
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] ** 2;
      normB += vecB[i] ** 2;
    }
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  // 根据用户的提问，检索最相关的记忆
  async search(query: string, topK: number = 3) {
    if (this.records.length === 0) {
      console.log(`🔍 [Memory] 记忆库为空，无法检索`);
      return [];
    }

    console.log(`🔍 [Memory] 正在检索与"${query}"相关的记忆...`);

    const queryVector = await this.getEmbedding(query);
    
    // 如果向量编码失败，使用简单的文本匹配
    if (queryVector.length === 0) {
      const results = this.records
        .filter(r => r.text.includes(query) || query.includes(r.title))
        .slice(0, topK)
        .map(r => ({ ...r, score: 0.5 }));
      
      console.log(`🔍 [Memory] 使用文本匹配，找到 ${results.length} 条相关记忆`);
      return results;
    }

    // 遍历数据库计算相似度并排序
    const results = this.records
      .filter(r => r.vector && r.vector.length > 0)
      .map(record => ({
        ...record,
        score: this.cosineSimilarity(queryVector, record.vector!)
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    console.log(`🔍 [Memory] 找到 ${results.length} 条相关记忆，最高相似度: ${results[0]?.score?.toFixed(3) || 0}`);
    return results;
  }

  // 获取所有记忆
  getAllMemories() {
    return this.records.map(r => ({
      id: r.id,
      title: r.title,
      url: r.url,
      timestamp: r.timestamp
    }));
  }

  // 清空记忆
  clearMemory() {
    this.records = [];
    this.save();
    console.log(`🗑️ [Memory] 记忆已清空`);
  }

  // 获取记忆统计
  getStats() {
    return {
      totalRecords: this.records.length,
      oldestRecord: this.records.length > 0 ? new Date(Math.min(...this.records.map(r => r.timestamp))) : null,
      newestRecord: this.records.length > 0 ? new Date(Math.max(...this.records.map(r => r.timestamp))) : null
    };
  }

  private save() {
    try {
      fs.writeFileSync(DB_PATH, JSON.stringify(this.records, null, 2));
    } catch (error: any) {
      console.error(`❌ [Memory] 保存失败:`, error.message);
    }
  }

  private load() {
    try {
      if (fs.existsSync(DB_PATH)) {
        this.records = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
        console.log(`💾 [Memory] 已加载 ${this.records.length} 条历史记忆`);
      }
    } catch (error: any) {
      console.error(`❌ [Memory] 加载失败:`, error.message);
      this.records = [];
    }
  }
}