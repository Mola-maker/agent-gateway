// src/agent/chroma-vector-db.ts
// Node_C_VectorMemory: 企业级向量数据库 - 简化版（使用JSON存储）

import fs from 'fs';
import path from 'path';

interface MemoryRecord {
  id: string;
  text: string;
  url: string;
  title: string;
  timestamp: number;
  vector?: number[];
  metadata?: {
    department?: string;
    date?: string;
    category?: string;
  };
}

export class ChromaVectorDB {
  private records: MemoryRecord[] = [];
  private dbPath: string;

  constructor(dbPath: string = './chroma_memory.json') {
    this.dbPath = dbPath;
    this.load();
  }

  /**
   * 初始化（简化版）
   */
  async initialize(): Promise<void> {
    console.log(`✅ [VectorDB] 向量数据库已就绪 (JSON模式)`);
  }

  /**
   * 存入记忆
   */
  async addMemory(title: string, summary: string, url: string, metadata?: any): Promise<void> {
    // 防止重复
    if (this.records.some(r => r.url === url)) {
      console.log(`💾 [VectorDB] 记录已存在，跳过: ${title}`);
      return;
    }

    const record: MemoryRecord = {
      id: `notice_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      text: `标题：${title}\n摘要：${summary}`,
      url,
      title,
      timestamp: Date.now(),
      metadata
    };

    this.records.push(record);
    this.save();
    console.log(`💾 [VectorDB] 已存入: ${title}`);
  }

  /**
   * 批量存入
   */
  async addMemories(items: Array<{ title: string; summary: string; url: string; metadata?: any }>): Promise<void> {
    console.log(`💾 [VectorDB] 批量存入 ${items.length} 条记忆...`);

    for (const item of items) {
      // 防止重复
      if (!this.records.some(r => r.url === item.url)) {
        const record: MemoryRecord = {
          id: `notice_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          text: `标题：${item.title}\n摘要：${item.summary}`,
          url: item.url,
          title: item.title,
          timestamp: Date.now(),
          metadata: item.metadata
        };
        this.records.push(record);
      }
    }

    this.save();
    console.log(`✅ [VectorDB] 批量存入完成`);
  }

  /**
   * 搜索（文本匹配）
   */
  async search(query: string, topK: number = 5): Promise<any[]> {
    console.log(`🔍 [VectorDB] 搜索: "${query}"`);

    const queryLower = query.toLowerCase();
    const keywords = queryLower.split(/[,，、\s]+/).filter(k => k.length > 1);

    const results = this.records
      .map(record => {
        const textLower = record.text.toLowerCase();
        let score = 0;

        // 关键词匹配
        for (const keyword of keywords) {
          if (textLower.includes(keyword)) {
            score += 1;
          }
        }

        // 完全匹配加分
        if (textLower.includes(queryLower)) {
          score += 2;
        }

        return { ...record, score };
      })
      .filter(r => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    console.log(`🔍 [VectorDB] 找到 ${results.length} 条结果`);
    return results;
  }

  /**
   * 获取所有记忆
   */
  async getAllMemories(limit: number = 100): Promise<any[]> {
    return this.records
      .slice(0, limit)
      .map(r => ({
        id: r.id,
        title: r.title,
        url: r.url,
        timestamp: r.timestamp
      }));
  }

  /**
   * 获取统计信息
   */
  async getStats(): Promise<any> {
    return {
      totalRecords: this.records.length,
      status: 'connected',
      type: 'JSON'
    };
  }

  /**
   * 清空记忆
   */
  async clearMemory(): Promise<void> {
    this.records = [];
    this.save();
    console.log(`🗑️ [VectorDB] 记忆已清空`);
  }

  /**
   * 删除单条记忆
   */
  async deleteMemory(id: string): Promise<void> {
    this.records = this.records.filter(r => r.id !== id);
    this.save();
    console.log(`🗑️ [VectorDB] 已删除: ${id}`);
  }

  /**
   * 保存到文件
   */
  private save(): void {
    try {
      fs.writeFileSync(this.dbPath, JSON.stringify(this.records, null, 2));
    } catch (error: any) {
      console.error(`❌ [VectorDB] 保存失败:`, error.message);
    }
  }

  /**
   * 从文件加载
   */
  private load(): void {
    try {
      if (fs.existsSync(this.dbPath)) {
        this.records = JSON.parse(fs.readFileSync(this.dbPath, 'utf-8'));
        console.log(`💾 [VectorDB] 已加载 ${this.records.length} 条历史记忆`);
      }
    } catch (error: any) {
      console.error(`❌ [VectorDB] 加载失败:`, error.message);
      this.records = [];
    }
  }
}