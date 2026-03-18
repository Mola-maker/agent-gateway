// src/scraper/scraper.js
require('dotenv').config();
const { chromium } = require('playwright');
const OpenAI = require('openai');

// ==========================================
// 🛡️ 高维魔法 0：环境变量净化器
// ==========================================
function sanitizeConfig(value, isUrl = false) {
    if (!value) return '';
    let cleaned = value.toString().trim();
    if (isUrl && cleaned.match(/\[.*\]\((.*)\)/)) {
        cleaned = cleaned.replace(/\[.*\]\((.*)\)/, '$1');
    }
    return cleaned;
}

const API_KEY = sanitizeConfig(process.env.OPENROUTER_API_KEY);
const TARGET_URL = sanitizeConfig(process.env.TARGET_URL, true);

if (!API_KEY || !API_KEY.startsWith('sk-')) {
    console.error('💥 [Fatal Error] OPENROUTER_API_KEY 缺失或格式错误！');
    process.exit(1);
}
if (!TARGET_URL || !TARGET_URL.startsWith('http')) {
    console.error('💥 [Fatal Error] TARGET_URL 缺失或格式错误！');
    process.exit(1);
}

const openai = new OpenAI({
    baseURL: sanitizeConfig("https://openrouter.ai/api/v1", true),
    apiKey: API_KEY,
});

// ==========================================
// 🛡️ 高维魔法 1：极其强壮的 JSON 提取器
// ==========================================
function extractJSONFromText(text) {
    try {
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (jsonMatch) return JSON.parse(jsonMatch[0]);
        
        const objMatch = text.match(/\{[\s\S]*\}/);
        if (objMatch) return JSON.parse(objMatch[0]);
        
        throw new Error("未能用正则匹配到有效的 JSON 结构");
    } catch (e) {
        console.error("⚠️ JSON 提取失败，大模型原始输出为：\n", text.substring(0, 200) + "...");
        throw e;
    }
}

// ==========================================
// 🛡️ 高维魔法 5：多模型灾备路由中枢 (Auto-Fallback)
// ==========================================
async function askAgent(systemPrompt, userPrompt, temperature = 0.2) {
    // 允许你在 .env 中配置优先模型，如果不配，默认用极高性价比的 deepseek
    const primaryModel = process.env.LLM_MODEL || "deepseek/deepseek-chat"; 
    // 当主力模型抽风或 ID 不存在时，自动切换到这个绝对可靠的开源神作灾备
    const backupModel = "qwen/qwen-2.5-72b-instruct"; 

    try {
        const response = await openai.chat.completions.create({
            model: primaryModel,
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ],
            temperature: temperature,
        });
        return response.choices[0].message.content;
    } catch (error) {
        // 捕获 400 (模型不存在) 或 404，触发灾备机制
        if (error.status === 400 || error.status === 404) {
            console.warn(`\n⚠️ [Auto-Healing] 主力模型 ${primaryModel} 罢工或ID失效 (400)！`);
            console.warn(`🔄 正在无缝切换至灾备大脑：${backupModel} ...`);
            
            const fallbackResponse = await openai.chat.completions.create({
                model: backupModel,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt }
                ],
                temperature: temperature,
            });
            return fallbackResponse.choices[0].message.content;
        }
        throw error; // 其他严重网络报错则向上抛出
    }
}

// ==========================================
// 🪐 核心 Agent 执行主循环
// ==========================================
async function fetchNoticesWithAgent() {
    console.log('\n🚀 [System] AI Agent 已唤醒，正在配置视觉引擎...');
    const browser = await chromium.launch({ headless: false, channel: 'msedge' });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();

    try {
        console.log(`🌐 [Navigation] Agent 空降指定入口: ${TARGET_URL}`);
        await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForTimeout(2000); 

        // 阶段一：感知与寻路
        console.log('👀 [Perception] 正在扫描页面交互元素...');
        const baseUri = page.url(); 

        const interactiveElements = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('a'))
                .map(a => ({ 
                    text: a.innerText.replace(/\s+/g, ' ').trim(), 
                    href: a.getAttribute('href') 
                }))
                .filter(a => a.text.length > 1 && a.href && !a.href.startsWith('javascript:'));
        });

        console.log('🧠 [Thinking] Agent 正在思考“更多通知”的坐标...');
        // 🛡️ 高维魔法 6：字符截断保护，防止大模型 Token 爆仓
        const navDataString = JSON.stringify(interactiveElements).substring(0, 8000);
        
        const rawMoreUrl = await askAgent(
            "你是一个网页导航智能体。从提供的链接列表中，找到唯一一个代表“学校通知公告更多信息”或“OA通知列表”的入口链接的 href 属性值。只返回该 href 字符串本身，严禁输出任何其他字符、引号或解释。",
            `页面链接列表数据：\n${navDataString}`,
            0.1
        );

        let finalMoreUrl;
        try {
            finalMoreUrl = new URL(rawMoreUrl.trim(), baseUri).href;
        } catch (e) {
            console.warn(`⚠️ URL 补全失败，尝试降级使用原 URL: ${rawMoreUrl}`);
            finalMoreUrl = rawMoreUrl.trim();
        }

        console.log(`🎯 [Action] Agent 锁定目标，发起空间跳跃: ${finalMoreUrl}`);
        await page.goto(finalMoreUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForTimeout(2000);

        // 阶段二：深度阅读与结构化提炼
        console.log('📖 [Perception] Agent 正在全盘扫描目标列表页...');
        const listPageBaseUri = page.url();
        
        const pageContent = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('a')).map(a => {
                return {
                    text: a.innerText.replace(/\s+/g, ' ').trim(),
                    link: a.getAttribute('href'),
                    context: a.parentElement ? a.parentElement.innerText.replace(/\s+/g, ' ').trim() : ''
                };
            }).filter(item => item.text.length > 5); 
        });

        console.log('🧠 [Thinking] 引擎全开，正在将混沌网页提炼为标准 JSON 协议...');
        
        let finalData = null;
        let retries = 2;

        while (retries > 0) {
            try {
                // 再次实施字符截断保护
                const contentDataString = JSON.stringify(pageContent).substring(0, 15000);
                
                const rawContent = await askAgent(
                    `你是一个顶尖的数据提取智能体。请从数据中提取所有的“校务/教务/活动通知”。
规则：
1. 必须返回一个纯粹的 JSON 数组。
2. 数组的每个对象包含四个字段：title(标题), department(发布部门，无则填"未知"), date(日期，无则填"未知"), link(相对链接的原始href)。
3. 绝对不要包含任何开场白、结尾语或 Markdown 标记。`,
                    contentDataString,
                    0.2
                );

                const parsedJson = extractJSONFromText(rawContent);
                
                finalData = parsedJson.map(item => ({
                    ...item,
                    link: item.link ? new URL(item.link, listPageBaseUri).href : '无链接'
                }));

                break; // 成功解析，跳出循环

            } catch (error) {
                console.error(`⚠️ JSON 提取异常，准备重新推理，剩余重试次数: ${retries - 1}`);
                retries--;
                if (retries === 0) throw new Error("大模型多次未能输出有效 JSON");
            }
        }

        console.log(`✅ [Success] Agent 任务圆满完成，共提炼 ${finalData.length} 条高价值情报！`);
        return finalData;

    } catch (error) {
        console.error('\n❌ [Fatal] Agent 执行链断裂:', error.message || error);
        return { 
            status: 'error',
            message: 'Agent 在执行过程中遭遇不可逆错误',
            details: error.message 
        };
    } finally {
        await browser.close();
    }
}

module.exports = { fetchNoticesWithAgent };