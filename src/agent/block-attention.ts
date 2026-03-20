// src/agent/block-attention.ts

/**
 * Block Attention Residuals 算法 (Node.js 优化版)
 * 来源: "Attention_Residuals.pdf" (Kimi Team) [cite: 1, 2, 3]
 * 理论基础: 替换固定权重的累加，使用 softmax 注意力对之前的块级表示进行加权 
 * 工业应用: RAG 上下文动态路由与记忆加权
 */

// ============================================================================
// 模块 1：修复后的基础张量运算 (用于学术验证与小规模计算)
// ============================================================================

export class MathTensorUtils {
  /**
   * 修复后的安全加权求和 (Weighted Sum)
   * 维度映射: weights: [N, B, T], V: [N, B, T, D] -> Output: [B, T, D]
   */
  static safeWeightedSum(weights: number[][][], V: number[][][][], hiddenDim: number): number[][][] {
    const numBlocks = V.length;
    if (numBlocks === 0) return [];
    
    const batchSize = V[0].length;
    const seqLen = V[0][0].length;
    const result: number[][][] = [];

    for (let b = 0; b < batchSize; b++) {
      const seqResult: number[][] = [];
      for (let t = 0; t < seqLen; t++) {
        const dimResult: number[] = new Array(hiddenDim).fill(0);
        for (let d = 0; d < hiddenDim; d++) {
          let sum = 0;
          for (let n = 0; n < numBlocks; n++) {
            // 安全读取，防止 undefined 崩溃
            const weight = weights?.[n]?.[b]?.[t] ?? 0;
            const value = V?.[n]?.[b]?.[t]?.[d] ?? 0;
            sum += weight * value;
          }
          dimResult[d] = sum;
        }
        seqResult.push(dimResult); // 修复：正确保持了 3D 结构
      }
      result.push(seqResult);
    }
    return result;
  }

  /**
   * 余弦相似度计算
   */
  static cosineSimilarity(vecA: number[], vecB: number[]): number {
    let dotProduct = 0, normA = 0, normB = 0;
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] ** 2;
      normB += vecB[i] ** 2;
    }
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}

// ============================================================================
// 模块 2：API 升级版 - RAG Block Attention Engine
// 作用: 将论文中的 Block AttnRes 思想应用于动态重组 LLM 上下文窗口
// ============================================================================

export interface MemoryBlock {
  id: string;
  text: string;
  vector: number[];
  metadata: Record<string, any>;
}

export class RAGBlockAttention {
  /**
   * 应用 Block Attention 思想对检索到的记忆块进行加权和排序
   * 理论对应: 论文中的 inter-block attention，计算查询与 N 个历史块的 logits 并 Softmax [cite: 136]
   * * @param queryVector 当前用户提问的向量 (对应伪查询向量 w_l)
   * @param memoryBlocks 从 ChromaDB 检索出的历史候选块 (对应 b_0 ... b_{n-1})
   * @param topK 最终保留的上下文数量
   * @param temperature 调节 Softmax 锐度的温度系数
   */
  public routeContextBlocks(
    queryVector: number[],
    memoryBlocks: MemoryBlock[],
    topK: number = 3,
    temperature: number = 0.5
  ): { selectedContext: string; weights: number[]; blocks: MemoryBlock[] } {
    
    if (memoryBlocks.length === 0) {
      return { selectedContext: "", weights: [], blocks: [] };
    }

    // 1. 计算 Logits (使用余弦相似度模拟论文中的点积投影)
    const logits = memoryBlocks.map(block => 
      MathTensorUtils.cosineSimilarity(queryVector, block.vector) / temperature
    );

    // 2. 在深度（块列表）维度上应用 Softmax (防止 PreNorm 类似的上下文稀释) [cite: 6, 8]
    const maxLogit = Math.max(...logits);
    const expLogits = logits.map(l => Math.exp(l - maxLogit));
    const sumExp = expLogits.reduce((a, b) => a + b, 0);
    const softmaxWeights = expLogits.map(e => e / sumExp);

    // 3. 将块与对应的注意力权重绑定并排序
    const weightedBlocks = memoryBlocks.map((block, index) => ({
      block,
      weight: softmaxWeights[index]
    })).sort((a, b) => b.weight - a.weight);

    // 4. 截断 (Top-K) 并组装最终的高价值上下文
    const topBlocks = weightedBlocks.slice(0, topK);
    
    const selectedContext = topBlocks.map((item, idx) => 
      `[Context Block ${idx + 1} | Attention Weight: ${(item.weight * 100).toFixed(2)}%]\n${item.block.text}`
    ).join('\n\n');

    return {
      selectedContext,
      weights: topBlocks.map(item => item.weight),
      blocks: topBlocks.map(item => item.block)
    };
  }
}