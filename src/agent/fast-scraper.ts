// src/agent/fast-scraper.ts
// Node_A_Patrol: 异步爬虫引擎 - 极速模式

import { chromium, Browser, Page } from 'playwright';
import OpenAI from 'openai';

interface ScrapedNotice {
  title: string;
  link: string;
  summary?: string;
  content?: string;
  department?: string;
  date?: string;
}

export class FastScraperEngine {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      baseURL: "[https://openrouter.ai/api/v1](https://openrouter.ai/api/v1)",
      apiKey: process.env.OPENROUTER_API_KEY,
    });
  }

  // 🛡️ 绞肉机：清理大模型的回答
  private sanitizeUrl(url: string | undefined): string {
    if (!url) return '';
    let cleaned = url.trim();
    const mdMatch = cleaned.match(/\[.*\]\((.*)\)/);
    if (mdMatch) cleaned = mdMatch[1];
    cleaned = cleaned.replace(/```[a-z]*\n?/g, '').replace(/```/g, '');
    cleaned = cleaned.replace(/^[`"'\s]+|[`"'\s]+$/g, '');
    return cleaned;
  }

  async scrapeWithSpeed(targetUrl: string, intent: string): Promise<ScrapedNotice[]> {
    const startTime = Date.now();
    console.log(`🚀 [FastScraper] 极速模式启动...`);

    const browser = await chromium.launch({ headless: true, channel: 'msedge' });
    const page = await browser.newPage();

    try {
      // 1. 寻路获取列表
      const list = await this.fastGetList(page, targetUrl);
      console.log(`📋 [FastScraper] 获取列表: ${list.length} 条`);

      // 2. 筛选
      const filtered = await this.smartFilter(list, intent);
      console.log(`🎯 [FastScraper] 筛选目标: ${filtered.length} 条`);

      // 3. 并发下钻
      const detailed = await this.parallelDive(browser, filtered);
      console.log(`✅ [FastScraper] 完成深度爬取: ${detailed.length} 条`);

      return detailed;
    } finally {
      await browser.close();
    }
  }

  private async fastGetList(page: Page, url: string): Promise<ScrapedNotice[]> {
    console.log(`🌐 [Navigation] 空降: ${url}`);
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    
    const links = await page.evaluate(() => 
      Array.from(document.querySelectorAll('a')).map(a => ({ 
          text: a.innerText.replace(/\s+/g, ' ').trim(), 
          href: a.getAttribute('href') 
      })).filter(l => l.text.length > 2)
    );
    
    // 使用大模型真实寻路
    const response = await this.openai.chat.completions.create({
      model: process.env.LLM_MODEL || "deepseek/deepseek-chat",
      messages: [
        { role: "system", content: "你是一个寻路专家，请从链接列表中返回‘更多通知’或‘通知公告’的唯一 href 字符串。只需返回字符串，严禁废话。" },
        { role: "user", content: JSON.stringify(links).substring(0, 8000) }
      ],
      temperature: 0.1,
    });
    
    const decision = response.choices[0].message.content || '';
    const moreUrl = new URL(this.sanitizeUrl(decision), page.url()).href;
    console.log(`🎯 [Action] 锁定列表页: ${moreUrl}`);
    
    await page.goto(moreUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    return await page.evaluate(() => 
      Array.from(document.querySelectorAll('div.li.rel')).map(item => ({
          title: item.querySelector('a.font14')?.textContent?.trim() || '',
          link: (item.querySelector('a.font14') as HTMLAnchorElement)?.href || ''
      })).filter(n => n.title && n.link)
    );
  }

  private async smartFilter(list: ScrapedNotice[], intent: string): Promise<ScrapedNotice[]> {
    const filterRes = await this.openai.chat.completions.create({
      model: process.env.LLM_MODEL || "deepseek/deepseek-chat",
      messages: [
        { role: "system", content: "选出与意图高度相关的所有通知。只返回 JSON 数组，格式为 [{\"title\": \"标题\", \"link\": \"链接\"}]。" },
        { role: "user", content: `意图：${intent}\n列表：${JSON.stringify(list).substring(0, 10000)}` }
      ],
      temperature: 0.1,
    });
    
    const selected = JSON.parse(filterRes.choices[0].message.content?.match(/\[.*\]/s)?.[0] || "[]");
    return selected;
  }

  private async parallelDive(browser: Browser, notices: ScrapedNotice[]): Promise<ScrapedNotice[]> {
    const divePromises = notices.map(async (item) => {
        const page = await browser.newPage();
        
        // 资源拦截极速魔法
        await page.route('**/*', route => {
            const type = route.request().resourceType();
            if (['image', 'stylesheet', 'font', 'media'].includes(type)) route.abort();
            else route.continue();
        });

        try {
            await page.goto(item.link, { waitUntil: 'domcontentloaded', timeout: 30000 });
            const body = await page.evaluate(() => document.body.innerText);
            const cleanBody = body.replace(/\s+/g, ' ').trim().substring(0, 8000);
            
            const summaryRes = await this.openai.chat.completions.create({
                model: process.env.LLM_MODEL || "deepseek/deepseek-chat",
                messages: [
                  { role: "system", content: "提炼通知正文精华。包含：时间、地点、联系方式。" },
                  { role: "user", content: `标题：${item.title}\n正文：${cleanBody}` }
                ],
                temperature: 0.1,
            });
            return { title: item.title, summary: summaryRes.choices[0].message.content || '无摘要', link: item.link };
        } catch (e) {
            console.warn(`⚠️ 下钻失败: ${item.title}`);
            return { title: item.title, summary: '下钻失败', link: item.link };
        } finally {
            await page.close();
        }
    });

    return await Promise.all(divePromises);
  }
}