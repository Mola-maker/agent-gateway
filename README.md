# 🎓 JLU Agent Gateway — Your Personal Campus AI

<p align="center">
  <strong>Transforming chaotic university notices into intelligent, terminal-ready data streams.</strong>
</p>

<p align="center">
  <a href="https://github.com/你的用户名/agent-gateway/stargazers"><img src="https://img.shields.io/github/stars/你的用户名/agent-gateway?style=for-the-badge&color=F3F4F6&logo=github&logoColor=black" alt="Stars"></a>
  <a href="https://github.com/你的用户名/agent-gateway/network/members"><img src="https://img.shields.io/github/forks/你的用户名/agent-gateway?style=for-the-badge&color=F3F4F6&logo=github&logoColor=black" alt="Forks"></a>
  <a href="https://github.com/你的用户名/agent-gateway/blob/main/LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge" alt="MIT License"></a>
  <img src="https://img.shields.io/badge/Node.js-≥18.0.0-43853D?style=for-the-badge&logo=node.js&logoColor=white" alt="Node Version">
</p>

**JLU Agent Gateway** 是一个运行在你个人设备上的“高校通知自动化代理网关”。它利用最前沿的大语言模型（LLM）和 Playwright 视觉引擎，自动潜入吉林大学（JLU）等高校复杂的 OA 系统，拥有“自主寻路”和“阅读理解”能力，将庞杂的网页骨架降维、提炼为绝对纯净的 JSON 数据。

这个网关是专为**微型掌上终端（如 STM32、树莓派等 MCU 设备）**量身打造的数据控制中枢。让繁重的 DOM 解析和 AI 推理留在云端，让你的硬件终端轻装上阵。

> ✨ **Special Shoutout: 欢迎吉林大学 (JLU) 的同学们！**
> Made by a JLUer, for JLUers. 天天被群里杂乱的通知轰炸？不知道哪些活动跟自己有关？这个项目旨在打造你的专属校务数字私仆。欢迎 Fork, PR, 让我们一起用 AI 优雅地重构校园数字生活！

---

## 🌟 Highlights (核心特性)

* 🧠 **LLM 驱动的视觉寻路 (Browser Agent):** 告别脆弱的 XPath 和 CSS 硬编码！接入阶跃星辰 / DeepSeek 等顶尖大模型，让 AI 自己“看懂”网页，自主寻找“更多”等关键入口。
* 🛡️ **高维自愈与灾备机制 (Auto-Healing):** 面对大模型幻觉、相对路径失效、JSON 解析异常，拥有极强的正则洗脱和多次重试重排机制。更有主备模型无缝切换路由。
* ⚡ **极简的终端接入点 (Hardware Friendly):** 对下屏蔽复杂的 CA 认证和网页加载，仅对外暴露一个极简的 HTTP GET 接口。你的掌上小终端只需要几行代码，就能拿到完美格式化的情报。
* 🕵️ **伪装与反拦截:** 使用本机 Edge 浏览器无头模式，并注入拟人化的 User-Agent 与智能加载等待策略，平稳穿梭于校园内网。

## ⚙️ How it works (架构设计)

云端重载，终端轻载。网关负责一切脏活累活。

```text
  [ 你的掌上迷你终端 ] (STM32 / ESP32 / 树莓派)
           │ 
           │ (发起轻量级 GET /api/notices 请求)
           ▼
┌──────────────────────────────────────────────┐
│             Agent Gateway (Node.js)          │
│                                              │
│  [ Playwright 爬虫 ]  <───>  [ LLM 大脑中枢 ]│
│  (负责无头浏览与DOM抓取)        (负责寻路与数据提炼) │
└──────────┬─────────────────────────▲─────────┘
           │ (访问 & 降维)            │ (返回结构化 JSON)
           ▼                         │
 [ 吉林大学 OA 系统 / 校园网 ] ────────┘
 
 🚀 Quick Start (极速启动)
1. 环境准备
确保你的电脑已安装 Node.js (≥18)，且当前处于校园网环境（或连接了学校 VPN）。

2. 克隆与安装
Bash
git clone [https://github.com/你的用户名/agent-gateway.git](https://github.com/你的用户名/agent-gateway.git)
cd agent-gateway

# 安装核心依赖
npm install

# 下载 Playwright 必备的浏览器内核 (仅需一次)
npx playwright install
3. 配置大脑密钥
在项目根目录复制一份环境变量模板，并命名为 .env：

Bash
cp .env.example .env
打开 .env 文件，填入你的配置：

代码段
# 你的目标网址 (例如吉大 OA)
TARGET_URL=[https://oa.jlu.edu.cn/](https://oa.jlu.edu.cn/)

# 你的 OpenRouter API 密钥 (用于驱动 LLM)
OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxxxxxxxxxx

# (可选) 你可以指定喜欢的大模型，默认使用深求或阶跃星辰
LLM_MODEL=stepfun/step-1-8k
4. 点火运行
Bash
node index.js
看到终端输出 🔥 [System] AI Agent 网关已正式上线！ 后，在你的浏览器或硬件终端中访问：
👉 http://localhost:3000/api/notices

等待几秒钟（看着终端里 Agent 的思考日志），你将收到一份震撼的纯净 JSON 数据！

🗺️ Roadmap (星辰大海)
这只是长征的第一步，我们正在构建一个私有化的全能校务数字员工。接下来即将解锁：

[ ] 潜水员模式 (Deep-Dive): 根据你的意图，自动点进通知详情页阅读长文本正文。

[ ] 多模态文件解析: 自动下载并读取通知里的 .zip、.docx、.xlsx 附件。

[ ] 记忆中枢与对话接口: 接入向量数据库，你可以随时问它：“最近那个机械设计比赛找谁报名？电话多少？”

[ ] 终端反向控制: 支持硬件终端通过按钮向网关发送意图过滤指令。

🤝 Contributing
欢迎任何形式的贡献！无论是提交 Issue、改进正则匹配，还是增加支持其他高校解析的 Prompt，都非常欢迎。
Please feel free to open a Pull Request. Let's build something awesome together! 🤖

<p align="center">
<i>"Don't just write code, create an Agent."</i>
</p>