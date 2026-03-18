// src/scraper/login.js
require('dotenv').config(); // 第一时间加载 .env 里的机密信息
const { chromium } = require('playwright');

async function loginAndFetchOA() {
    console.log('🚀 启动浏览器引擎...');
    // headless: false 方便我们本地调试时看着它自动操作，等部署到服务器时再改成 true
    const browser = await chromium.launch({ headless: false }); 
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
        const targetUrl = process.env.TARGET_URL;
        console.log(`🌐 正在前往目标站点: ${targetUrl}`);
        
        await page.goto(targetUrl, { waitUntil: 'networkidle' });

        // --- 这里是接下来的重头戏 ---
        // 1. 定位输入框并填入学号密码 (process.env.USERNAME / PASSWORD)
        // 2. 处理验证码 (稍后我们要讨论是用 OCR 还是平台接入)
        // 3. 点击登录，等待跳转并保存 Session/Cookie

        console.log('🛑 骨架运行完毕，等待下一步指令...');
        
    } catch (error) {
        console.error('❌ 爬虫运行出错:', error);
    } finally {
      await browser.close(); 
    }
}

// 供我们网关的主程序调用
module.exports = { loginAndFetchOA };