// src/agent/agent-tool.actions.ts
import { chromium, Browser, Page } from 'playwright';
import OpenAI from 'openai';
import { sanitizeUrl, cleanHtmlText } from './sanitizer.js';

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
 * 🚀 导出 1：自动化寻路获取列表 (Scout)
 */
export async function executeScoutAction(page: Page, openai: OpenAI, targetUrl: string) {
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

    return await page.evaluate(() => 
        Array.from(document.querySelectorAll('div.li.rel')).map(item => ({
            title: item.querySelector('a.font14')?.textContent?.trim(),
            link: (item.querySelector('a.font14') as HTMLAnchorElement)?.href
        }))
    );
}

/**
 * 🚀 导出 2：深度内容提取 (Dive) - 修复此处的导出缺失
 */
export async function executeDiveAction(browser: Browser, url: string): Promise<string> {
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        const rawContent = await page.evaluate(() => document.body.innerText);
        return cleanHtmlText(rawContent);
    } finally {
        await page.close();
    }
}

/**
 * 🚀 导出 3：一站式全自动流程 (Pipeline)
 */
export async function executePipelineAction(browser: Browser, openai: OpenAI, intent: string) {
    const page = await browser.newPage();
    try {
        const list = await executeScoutAction(page, openai, process.env.TARGET_URL!);
        const filterRes = await smartAsk(openai,
            "选出与意图最相关的最多3个通知，返回 JSON 数组。",
            `意图：${intent}\n列表：${JSON.stringify(list)}`
        );
        const selected = JSON.parse(filterRes.match(/\[.*\]/s)?.[0] || "[]");
        
        const finalReports = [];
        for (const item of selected) {
            const body = await executeDiveAction(browser, item.link); // 复用 dive 逻辑
            const summary = await smartAsk(openai,
                "提炼通知正文。包含：时间、地点、联系方式。",
                `标题：${item.title}\n正文：${body}`
            );
            finalReports.push({ title: item.title, summary, url: item.link });
        }
        return finalReports;
    } finally {
        await page.close();
    }
}