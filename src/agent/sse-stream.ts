// src/agent/sse-stream.ts
// Node_E_Dashboard: Server-Sent Events 流式API

import express from 'express';
type Response = express.Response;

export interface StreamMessage {
  type: 'start' | 'progress' | 'data' | 'error' | 'end';
  payload: any;
  timestamp: number;
}

export class SSEStreamHandler {
  private res: Response;
  private isClosed: boolean = false;

  constructor(res: Response) {
    this.res = res;
    this.setupSSE();
  }

  /**
   * 设置SSE响应头
   */
  private setupSSE(): void {
    this.res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    // 处理客户端断开连接
    this.res.on('close', () => {
      this.isClosed = true;
      console.log(`📡 [SSE] 客户端断开连接`);
    });
  }

  /**
   * 发送消息
   */
  send(message: StreamMessage): void {
    if (this.isClosed) return;

    const data = `data: ${JSON.stringify(message)}\n\n`;
    this.res.write(data);
  }

  /**
   * 发送开始信号
   */
  sendStart(message: string = '任务开始'): void {
    this.send({
      type: 'start',
      payload: { message },
      timestamp: Date.now()
    });
  }

  /**
   * 发送进度更新
   */
  sendProgress(step: string, progress: number, details?: any): void {
    this.send({
      type: 'progress',
      payload: { step, progress, details },
      timestamp: Date.now()
    });
  }

  /**
   * 发送数据
   */
  sendData(data: any): void {
    this.send({
      type: 'data',
      payload: data,
      timestamp: Date.now()
    });
  }

  /**
   * 发送错误
   */
  sendError(error: string): void {
    this.send({
      type: 'error',
      payload: { error },
      timestamp: Date.now()
    });
  }

  /**
   * 发送结束信号
   */
  sendEnd(message: string = '任务完成'): void {
    if (this.isClosed) return;

    this.send({
      type: 'end',
      payload: { message },
      timestamp: Date.now()
    });
    
    this.res.end();
    this.isClosed = true;
  }

  /**
   * 流式发送LLM响应
   */
  async streamLLMResponse(asyncGenerator: AsyncGenerator<string>): Promise<void> {
    this.sendStart('AI正在思考...');
    
    let fullResponse = '';
    let chunkCount = 0;

    try {
      for await (const chunk of asyncGenerator) {
        fullResponse += chunk;
        chunkCount++;
        
        // 每个chunk都实时发送
        this.send({
          type: 'data',
          payload: {
            chunk,
            fullResponse,
            chunkCount
          },
          timestamp: Date.now()
        });
      }

      this.sendEnd('AI响应完成');
    } catch (error: any) {
      this.sendError(error.message);
    }
  }

  /**
   * 流式发送爬虫进度
   */
  async streamScraperProgress(steps: Array<{name: string, action: () => Promise<any>}>): Promise<any[]> {
    this.sendStart('爬虫任务启动...');
    
    const results: any[] = [];
    const totalSteps = steps.length;

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const progress = Math.round(((i + 1) / totalSteps) * 100);

      this.sendProgress(step.name, progress, {
        currentStep: i + 1,
        totalSteps
      });

      try {
        const result = await step.action();
        results.push(result);
        
        this.send({
          type: 'data',
          payload: {
            step: step.name,
            result,
            progress
          },
          timestamp: Date.now()
        });
      } catch (error: any) {
        this.sendError(`步骤 "${step.name}" 失败: ${error.message}`);
        throw error;
      }
    }

    this.sendEnd('爬虫任务完成');
    return results;
  }
}

/**
 * 创建SSE流处理器
 */
export function createSSEStream(res: Response): SSEStreamHandler {
  return new SSEStreamHandler(res);
}