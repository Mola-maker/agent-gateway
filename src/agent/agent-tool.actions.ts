// src/agent/agent-tool.actions.ts
// 模块A：探路者 (Scraper Agent) + 模块B：潜水员 (Deep-Dive Agent)

import playwright from 'playwright';
const { chromium } = playwright;
type Browser = playwright.Browser;
type Page = playwright.Page;
import OpenAI from 'openai';
import { sanitizeUrl, cleanHtmlText } from './sanitizer.ts';
import { LightVectorDB } from './vector-db.ts';
import { DocumentParser } from './document-parser.ts';

/**
 * 🛡️ 高维魔法：主备模型双回路切换
 */
async function smartAsk(openai: OpenAI, system: string, user: string): Promise<string> {
  const primary = process.env.LLM_MODEL || "stepfun/step-1-flash";
  const backup = process.env.BACKUP_LLM_MODEL || "deepseek/deepseek-chat";
  const models = [primary, backup];

  for (const model of models) {
    try {
      const res = await openai.chat.completions.create({
        model,
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
        temperature: 0.1,
      });
      return res.choices[0].message.content || '';
    } catch (e: any) {
      console.warn(`⚠️ 模型 ${model} 罢工，切换灾备路由...`);
      if (model === backup) break;
    }
  }
  throw new Error("全线大脑宕机");
}

/**
 * 🚀 模块A：探路者 (Scout) - 自动化寻路获取列表
 */
export async function executeScoutAction(page: Page, openai: OpenAI, targetUrl: string) {
  console.log(`🔍 [Scout] 开始探路: ${targetUrl}`);
  
  await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
  const links = await page.evaluate(() => 
    Array.from(document.querySelectorAll('a')).map(a => ({ 
      text: a.innerText.trim(), 
      href: a.getAttribute('href') 
    })).filter(l => l.text.length > 2)
  );
  
  const decision = await smartAsk(openai, 
    "返回‘更多通知’或‘通知公告’的唯一链接文本或href。",
    JSON.stringify(links).substring(0, 8000)
  );
  
  const moreUrl = new URL(sanitizeUrl(decision), page.url()).href;
  await page.goto(moreUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);

  const list = await page.evaluate(() => 
    Array.from(document.querySelectorAll('div.li.rel')).map(item => ({
      title: item.querySelector('a.font14')?.textContent?.trim(),
      link: (item.querySelector('a.font14') as HTMLAnchorElement)?.href
    }))
  );
  
  console.log(`✅ [Scout] 探路完成，找到 ${list.length} 条通知`);
  return list;
}

/**
 * 🚀 模块B：潜水员 (Dive) - 深度内容提取
 */
export async function executeDiveAction(browser: Browser, url: string): Promise<string> {
  console.log(`🏊 [Dive] 开始潜水: ${url}`);
  
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // 🛡️ 高速魔法：路由拦截。直接斩断所有图片、样式、字体的加载请求
  await page.route('**/*', route => {
    const type = route.request().resourceType();
    if (['image', 'stylesheet', 'font', 'media'].includes(type)) {
      route.abort();
    } else {
      route.continue();
    }
  });

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    const rawContent = await page.evaluate(() => document.body.innerText);
    const cleaned = cleanHtmlText(rawContent);
    console.log(`✅ [Dive] 潜水完成，提取 ${cleaned.length} 字符`);
    return cleaned;
  } finally {
    await page.close();
  }
}

/**
 * 🚀 模块B+：潜水员增强版 - 并发执行链
 */
export async function executePipelineAction(
  browser: Browser, 
  openai: OpenAI, 
  intent: string,
  vectorDB?: LightVectorDB
) {
  console.log(`🚀 [Pipeline] 启动全自动流水线，意图: ${intent}`);
  
  const page = await browser.newPage();
  try {
    // 阶段1：探路
    const list = await executeScoutAction(page, openai, process.env.TARGET_URL!);
    
    console.log(`🧠 [Filter] 正在筛选通知...`);
    // 阶段2：智能筛选
    const filterRes = await smartAsk(openai,
      "选出与意图高度相关的所有通知。只返回 JSON 数组，格式为 [{title, link}]。",
      `意图：${intent}\n列表：${JSON.stringify(list)}`
    );
    const selected = JSON.parse(filterRes.match(/\[.*\]/s)?.[0] || "[]");
    console.log(`🎯 [Target] 锁定了 ${selected.length} 个高价值目标，开始并发下钻！`);
    
    // 阶段3：并发潜水
    const divePromises = selected.map(async (item: any) => {
      const body = await executeDiveAction(browser, item.link);
      const summary = await smartAsk(openai,
        "提炼通知正文精华。包含：时间、地点、联系方式。",
        `标题：${item.title}\n正文：${body}`
      );
      
      // 存入记忆中枢
      if (vectorDB) {
        await vectorDB.addMemory(item.title, summary, item.link);
      }
      
      return { title: item.title, summary, url: item.link };
    });

    const finalReports = await Promise.all(divePromises);
    console.log(`✅ [Pipeline] 流水线完成，共处理 ${finalReports.length} 条通知`);
    
    return finalReports;
  } finally {
    await page.close();
  }
}

/**
 * 🚀 模块C：文件粉碎机集成 - 解析附件
 */
export async function executeParseAction(filePath: string) {
  console.log(`📄 [Parse] 开始解析文件: ${filePath}`);
  
  const parser = new DocumentParser();
  const result = await parser.parse(filePath);
  
  console.log(`✅ [Parse] 文件解析完成: ${result.filename} (${result.type})`);
  return result;
}