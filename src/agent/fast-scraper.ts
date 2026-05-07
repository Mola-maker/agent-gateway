// src/agent/fast-scraper.ts
// Node_A_Patrol: 异步爬虫引擎 - 极速模式

import { chromium, Browser, Page } from 'playwright';
import OpenAI from 'openai';
import { DocumentParser } from './document-parser.ts';

interface ScrapedNotice {
  title: string;
  link: string;
  summary?: string;
  content?: string;
  department?: string;
  date?: string;
  attachments?: string[];
}

export class FastScraperEngine {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: process.env.OPENROUTER_API_KEY,
    });
  }

  /**
   * 🛡️ 检查API密钥是否有效
   */
  private isApiKeyValid(): boolean {
    const apiKey = process.env.OPENROUTER_API_KEY;
    return !!(apiKey && apiKey.startsWith('sk-') && apiKey !== 'your_key_here');
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
    let decision = '';
    if (this.isApiKeyValid()) {
      const response = await this.openai.chat.completions.create({
        model: process.env.LLM_MODEL || "deepseek/deepseek-chat",
        messages: [
          { role: "system", content: "你是一个寻路专家，请从链接列表中返回‘更多通知’或‘通知公告’的唯一 href 字符串。只需返回字符串，严禁废话。" },
          { role: "user", content: JSON.stringify(links).substring(0, 8000) }
        ],
        temperature: 0.1,
      });
      decision = response.choices[0].message.content || '';
    } else {
      // 🛡️ 降级方案：查找包含"通知"或"公告"的链接
      console.log(`⚠️ [FastScraper] API密钥未配置，使用降级寻路`);
      const noticeLink = links.find(l => 
        l.text.includes('通知') || l.text.includes('公告') || l.text.includes('更多')
      );
      decision = noticeLink?.href || '';
    }
    const moreUrl = new URL(this.sanitizeUrl(decision), page.url()).href;
    console.log(`🎯 [Action] 锁定列表页: ${moreUrl}`);
    
    await page.goto(moreUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // 🚀 新增：分页爬取近一个月的所有通知
    const allNotices: ScrapedNotice[] = [];
    let currentPage = 1;
    const maxPages = 20; // 最多爬取20页
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

    while (currentPage <= maxPages) {
      console.log(`📄 [Pagination] 正在爬取第 ${currentPage} 页...`);
      
      const pageNotices = await page.evaluate(() => 
        Array.from(document.querySelectorAll('div.li.rel')).map(item => ({
            title: item.querySelector('a.font14')?.textContent?.trim() || '',
            link: (item.querySelector('a.font14') as HTMLAnchorElement)?.href || '',
            date: item.querySelector('.date')?.textContent?.trim() || 
                  item.querySelector('.time')?.textContent?.trim() || ''
        })).filter(n => n.title && n.link)
      );

      if (pageNotices.length === 0) {
        console.log(`📄 [Pagination] 第 ${currentPage} 页无数据，停止爬取`);
        break;
      }

      // 检查是否有超过一个月的旧数据
      const hasOldData = pageNotices.some(notice => {
        if (!notice.date) return false;
        const dateMatch = notice.date.match(/\d{4}[-/]\d{1,2}[-/]\d{1,2}/);
        if (dateMatch) {
          const noticeDate = new Date(dateMatch[0].replace(/\//g, '-'));
          return noticeDate < oneMonthAgo;
        }
        return false;
      });

      allNotices.push(...pageNotices);
      console.log(`📄 [Pagination] 第 ${currentPage} 页获取 ${pageNotices.length} 条，累计 ${allNotices.length} 条`);

      if (hasOldData) {
        console.log(`📄 [Pagination] 已获取近一个月数据，停止爬取`);
        break;
      }

      // 尝试点击下一页
      const nextPageExists = await page.evaluate(() => {
        const nextBtn = document.querySelector('a.next, a:contains("下一页"), a:contains("下页"), .pagination a:last-child');
        if (nextBtn && !nextBtn.classList.contains('disabled')) {
          (nextBtn as HTMLElement).click();
          return true;
        }
        return false;
      });

      if (!nextPageExists) {
        console.log(`📄 [Pagination] 无下一页按钮，停止爬取`);
        break;
      }

      await page.waitForTimeout(2000);
      currentPage++;
    }

    console.log(`✅ [Pagination] 分页爬取完成，共获取 ${allNotices.length} 条通知`);
    return allNotices;
  }

  private async smartFilter(list: ScrapedNotice[], intent: string): Promise<ScrapedNotice[]> {
    // 🛡️ 检查API密钥
    if (!this.isApiKeyValid()) {
      console.log(`⚠️ [FastScraper] API密钥未配置，跳过智能筛选，返回全部结果`);
      return list.slice(0, 10); // 返回前10条
    }

    try {
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
    } catch (error) {
      console.error(`❌ [FastScraper] 智能筛选失败，返回全部结果:`, error);
      return list.slice(0, 10);
    }
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
            let cleanBody = body.replace(/\s+/g, ' ').trim().substring(0, 8000);

            // 附件自动解析：检测并提取页面中的文件附件内容
            const attachmentUrls: string[] = await page.evaluate(() => {
              const FILE_PATTERN = /\.(docx?|xlsx?|pdf|zip)(\?.*)?$/i;
              return Array.from(document.querySelectorAll('a[href]'))
                .map((a: any) => a.href as string)
                .filter(href => FILE_PATTERN.test(href));
            });

            if (attachmentUrls.length > 0) {
              console.log(`📎 [FastScraper] 发现 ${attachmentUrls.length} 个附件，开始解析...`);
              const parser = new DocumentParser();
              const attachmentTexts: string[] = [];
              for (const url of attachmentUrls.slice(0, 2)) {
                try {
                  const doc = await parser.parseFromUrl(url);
                  attachmentTexts.push(`[附件: ${doc.filename}]\n${doc.content.substring(0, 1500)}`);
                  console.log(`✅ [FastScraper] 附件解析完成: ${doc.filename}`);
                } catch (e: any) {
                  console.warn(`⚠️ [FastScraper] 附件解析失败: ${url}`, e.message);
                }
              }
              if (attachmentTexts.length > 0) {
                cleanBody += '\n\n' + attachmentTexts.join('\n\n');
              }
            }

            // 🛡️ 检查API密钥
            let summary = '无摘要';
            if (this.isApiKeyValid()) {
              try {
                const summaryRes = await this.openai.chat.completions.create({
                    model: process.env.LLM_MODEL || "deepseek/deepseek-chat",
                    messages: [
                      { role: "system", content: "提炼通知正文精华。包含：时间、地点、联系方式。如有附件内容，一并提炼关键信息。" },
                      { role: "user", content: `标题：${item.title}\n正文：${cleanBody}` }
                    ],
                    temperature: 0.1,
                });
                summary = summaryRes.choices[0].message.content || '无摘要';
              } catch (e) {
                console.warn(`⚠️ [FastScraper] 摘要生成失败:`, e);
                summary = cleanBody.substring(0, 200) + '...';
              }
            } else {
              // 🛡️ 降级方案：截取正文前200字符作为摘要
              summary = cleanBody.substring(0, 200) + '...';
            }
            return { title: item.title, summary, link: item.link, attachments: attachmentUrls.slice(0, 2) };
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