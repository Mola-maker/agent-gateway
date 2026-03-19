// src/agent/document-parser.ts
// 模块C：文件粉碎机 (Document Parser)
// 专门负责识别 .zip、.docx、.xlsx，把复杂文档降维成纯文本

import fs from 'fs';
import path from 'path';

export interface ParsedDocument {
  filename: string;
  content: string;
  type: 'docx' | 'xlsx' | 'zip' | 'pdf' | 'unknown';
  metadata?: {
    pageCount?: number;
    sheetNames?: string[];
    fileCount?: number;
  };
}

export class DocumentParser {
  
  /**
   * 解析文档主入口
   */
  async parse(filePath: string): Promise<ParsedDocument> {
    const ext = path.extname(filePath).toLowerCase();
    const filename = path.basename(filePath);
    
    console.log(`📄 [Parser] 正在解析文件: ${filename}`);
    
    switch (ext) {
      case '.docx':
        return await this.parseDocx(filePath, filename);
      case '.xlsx':
      case '.xls':
        return await this.parseExcel(filePath, filename);
      case '.zip':
        return await this.parseZip(filePath, filename);
      case '.pdf':
        return await this.parsePdf(filePath, filename);
      default:
        return {
          filename,
          content: `不支持的文件格式: ${ext}`,
          type: 'unknown'
        };
    }
  }
  
  /**
   * 解析 Word 文档 (.docx)
   */
  private async parseDocx(filePath: string, filename: string): Promise<ParsedDocument> {
    try {
      const mammoth = await import('mammoth');
      const result = await mammoth.extractRawText({ path: filePath });
      
      console.log(`✅ [Parser] Word文档解析完成，提取 ${result.value.length} 字符`);
      
      return {
        filename,
        content: this.cleanText(result.value),
        type: 'docx'
      };
    } catch (error: any) {
      console.error(`❌ [Parser] Word解析失败:`, error.message);
      return {
        filename,
        content: `Word文档解析失败: ${error.message}`,
        type: 'docx'
      };
    }
  }
  
  /**
   * 解析 Excel 表格 (.xlsx)
   */
  private async parseExcel(filePath: string, filename: string): Promise<ParsedDocument> {
    try {
      const XLSX = await import('xlsx');
      const workbook = XLSX.readFile(filePath);
      const sheetNames = workbook.SheetNames;
      
      let allContent = '';
      
      for (const sheetName of sheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        
        allContent += `\n=== 工作表: ${sheetName} ===\n`;
        
        for (const row of jsonData as any[][]) {
          if (row && row.length > 0) {
            allContent += row.join(' | ') + '\n';
          }
        }
      }
      
      console.log(`✅ [Parser] Excel解析完成，共 ${sheetNames.length} 个工作表`);
      
      return {
        filename,
        content: this.cleanText(allContent),
        type: 'xlsx',
        metadata: {
          sheetNames
        }
      };
    } catch (error: any) {
      console.error(`❌ [Parser] Excel解析失败:`, error.message);
      return {
        filename,
        content: `Excel解析失败: ${error.message}`,
        type: 'xlsx'
      };
    }
  }
  
  /**
   * 解析 ZIP 压缩包
   */
  private async parseZip(filePath: string, filename: string): Promise<ParsedDocument> {
    try {
      const unzipper = await import('unzipper');
      const fs = await import('fs');
      
      const directory = await unzipper.Open.file(filePath);
      let allContent = '';
      let fileCount = 0;
      
      for (const file of directory.files) {
        if (file.type === 'File' && !file.path.startsWith('__MACOSX')) {
          fileCount++;
          allContent += `\n=== 文件: ${file.path} ===\n`;
          
          // 尝试读取文本文件
          const ext = path.extname(file.path).toLowerCase();
          if (['.txt', '.md', '.json', '.csv', '.xml'].includes(ext)) {
            const content = await file.buffer();
            allContent += content.toString('utf-8');
          } else {
            allContent += `[二进制文件，大小: ${file.uncompressedSize} 字节]`;
          }
        }
      }
      
      console.log(`✅ [Parser] ZIP解压完成，共 ${fileCount} 个文件`);
      
      return {
        filename,
        content: this.cleanText(allContent),
        type: 'zip',
        metadata: {
          fileCount
        }
      };
    } catch (error: any) {
      console.error(`❌ [Parser] ZIP解压失败:`, error.message);
      return {
        filename,
        content: `ZIP解压失败: ${error.message}`,
        type: 'zip'
      };
    }
  }
  
  /**
   * 解析 PDF 文档
   */
  private async parsePdf(filePath: string, filename: string): Promise<ParsedDocument> {
    try {
      const pdfParse = await import('pdf-parse');
      const dataBuffer = fs.readFileSync(filePath);
      const data = await pdfParse.default(dataBuffer);
      
      console.log(`✅ [Parser] PDF解析完成，共 ${data.numpages} 页`);
      
      return {
        filename,
        content: this.cleanText(data.text),
        type: 'pdf',
        metadata: {
          pageCount: data.numpages
        }
      };
    } catch (error: any) {
      console.error(`❌ [Parser] PDF解析失败:`, error.message);
      return {
        filename,
        content: `PDF解析失败: ${error.message}`,
        type: 'pdf'
      };
    }
  }
  
  /**
   * 清洗文本内容
   */
  private cleanText(text: string): string {
    return text
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 50000); // 限制最大长度
  }
  
  /**
   * 从URL下载并解析文件
   */
  async parseFromUrl(url: string): Promise<ParsedDocument> {
    const tempDir = './temp';
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const filename = path.basename(new URL(url).pathname) || 'downloaded_file';
    const tempPath = path.join(tempDir, filename);
    
    try {
      console.log(`📥 [Parser] 正在下载文件: ${url}`);
      
      const response = await fetch(url);
      const buffer = Buffer.from(await response.arrayBuffer());
      fs.writeFileSync(tempPath, buffer);
      
      const result = await this.parse(tempPath);
      
      // 清理临时文件
      fs.unlinkSync(tempPath);
      
      return result;
    } catch (error: any) {
      console.error(`❌ [Parser] 下载解析失败:`, error.message);
      return {
        filename,
        content: `文件下载解析失败: ${error.message}`,
        type: 'unknown'
      };
    }
  }
}