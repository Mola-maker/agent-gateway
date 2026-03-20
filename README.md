# 🎓 JLU Agent Gateway v2.0 — 硅谷级校园AI助手

<p align="center">
  <strong>Transforming chaotic university notices into intelligent, terminal-ready data streams.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Version-2.0.0-blue?style=for-the-badge" alt="Version">
  <img src="https://img.shields.io/badge/Node.js-≥18.0.0-43853D?style=for-the-badge&logo=node.js&logoColor=white" alt="Node Version">
  <img src="https://img.shields.io/badge/Architecture-Silicon%20Level-green?style=for-the-badge" alt="Architecture">
</p>

**JLU Agent Gateway v2.0** 是一个运行在你个人设备上的"高校通知自动化代理网关"。采用硅谷级Agent架构，拥有5大核心模块协同工作，自动潜入吉林大学（JLU）等高校复杂的 OA 系统，将庞杂的网页骨架降维、提炼为绝对纯净的 JSON 数据。

> ✨ **v2.0 重大升级：硅谷级架构跃迁**
> - 🏗️ 5大模块协同工作
> - 🧠 向量数据库记忆中枢
> - 💬 智能对话查询接口
> - 📄 多格式文件解析
> - ⚡ 并发处理能力
> - 🔄 分页爬取近一个月数据
> - 🛡️ API密钥检查和降级机制

---

## 🌟 Highlights (核心特性)

* 🧠 **LLM 驱动的视觉寻路 (Browser Agent):** 告别脆弱的 XPath 和 CSS 硬编码！接入阶跃星辰 / DeepSeek 等顶尖大模型，让 AI 自己"看懂"网页，自主寻找"更多"等关键入口。
* 🛡️ **高维自愈与灾备机制 (Auto-Healing):** 面对大模型幻觉、相对路径失效、JSON 解析异常，拥有极强的正则洗脱和多次重试重排机制。更有主备模型无缝切换路由。
* ⚡ **极简的终端接入点 (Hardware Friendly):** 对下屏蔽复杂的 CA 认证和网页加载，仅对外暴露一个极简的 HTTP GET 接口。你的掌上小终端只需要几行代码，就能拿到完美格式化的情报。
* 🕵️ **伪装与反拦截:** 使用本机 Edge 浏览器无头模式，并注入拟人化的 User-Agent 与智能加载等待策略，平稳穿梭于校园内网。
* 💾 **记忆中枢 (Vector DB):** 自动将爬取的内容存入本地向量数据库，支持语义检索。
* 💬 **智能对话 (Chat Controller):** 可以直接用自然语言提问，AI会从记忆库中检索并回答。
* 🔄 **分页爬取:** 自动爬取近一个月所有通知，智能日期检测。
* 🛡️ **降级机制:** 无API密钥时自动降级，保证系统可用性。

---

## 🏗️ 硅谷级架构 (5大模块)

```
┌─────────────────────────────────────────────────────────────┐
│                    JLU Agent Gateway v2.0                    │
├─────────────────────────────────────────────────────────────┤
│  模块A：探路者 (Scraper Agent)                               │
│  └── 自动寻路，分页爬取近一个月通知                            │
├─────────────────────────────────────────────────────────────┤
│  模块B：潜水员 (Deep-Dive Agent)                             │
│  └── 深入详情页，提取正文内容                                  │
├─────────────────────────────────────────────────────────────┤
│  模块C：文件粉碎机 (Document Parser)                         │
│  └── 解析 .zip、.docx、.xlsx、.pdf 文件                      │
├─────────────────────────────────────────────────────────────┤
│  模块D：记忆中枢 (Vector DB)                                 │
│  └── 向量存储，语义检索                                       │
├─────────────────────────────────────────────────────────────┤
│  模块E：前台接待员 (Chat Controller)                         │
│  └── 自然语言对话，智能问答                                    │
└─────────────────────────────────────────────────────────────┘
```

---

## ⚙️ How it works (架构设计)

```text
  [ 你的掌上迷你终端 ] (STM32 / ESP32 / 树莓派)
           │ 
           │ (发起轻量级 GET /api/notices 请求)
           ▼
┌──────────────────────────────────────────────┐
│             Agent Gateway v2.0 (Node.js)     │
│                                              │
│  [ 模块A: 探路者 ] ──> [ 模块B: 潜水员 ]     │
│         │                      │             │
│         ▼                      ▼             │
│  [ 模块C: 文件粉碎机 ]   [ 模块D: 记忆中枢 ] │
│         │                      │             │
│         └──────────┬───────────┘             │
│                    ▼                         │
│           [ 模块E: 前台接待员 ]              │
│                    │                         │
└────────────────────┼─────────────────────────┘
                     │ (返回结构化 JSON)
                     ▼
           [ 你的终端 / 浏览器 ]
```

---

## 🚀 Quick Start (极速启动)

### 1. 环境准备
确保你的电脑已安装 Node.js (≥18)，且当前处于校园网环境（或连接了学校 VPN）。

### 2. 克隆与安装
```bash
git clone https://github.com/你的用户名/agent-gateway.git
cd agent-gateway

# 安装核心依赖
npm install

# 下载 Playwright 必备的浏览器内核 (仅需一次)
npx playwright install
```

### 3. 配置大脑密钥
在项目根目录复制一份环境变量模板，并命名为 `.env`：

```bash
cp .env.example .env
```

打开 `.env` 文件，填入你的配置：

```env
# 你的目标网址 (例如吉大 OA)
TARGET_URL=https://oa.jlu.edu.cn/

# 你的 OpenRouter API 密钥 (用于驱动 LLM)
OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxxxxxxxxxx

# (可选) 你可以指定喜欢的大模型，默认使用阶跃星辰
LLM_MODEL=stepfun/step-3.5-flash:free
BACKUP_LLM_MODEL=deepseek/deepseek-chat
```

### 4. 点火运行
```bash
npm run start:v2
```

看到终端输出 `🚀 [System] JLU Agent Gateway v2.0 已上线！` 后，访问：
👉 http://localhost:3000

---

## 📡 API 接口

### 1. 获取校园通知 (全自动流水线)
```bash
GET /api/notices
```
返回：
```json
{
  "status": "ok",
  "intent": "最近的所有校内通知",
  "count": 30,
  "data": [
    {
      "title": "关于举办2024年...",
      "summary": "时间：2024年3月15日...",
      "url": "https://oa.jlu.edu.cn/..."
    }
  ]
}
```

### 2. 智能对话查询
```bash
POST /api/chat
Content-Type: application/json

{
  "query": "机械设计比赛找谁报名？"
}
```

### 3. 记忆统计
```bash
GET /api/stats
```

### 4. 所有记忆
```bash
GET /api/memories
```

### 5. 文件解析
```bash
POST /api/parse
Content-Type: application/json

{
  "filePath": "./downloads/notice.docx"
}
```

---

## 🖥️ 终端交互

启动后，终端会显示交互控制台：

```
🤖 JLU Agent 网关交互控制台 v2.0
当前监控意图: 最近的所有校内通知
==================================================
可用命令:
  - 输入新意图更新监控目标
  - "chat <问题>" 进行对话查询
  - "stats" 查看记忆统计
  - "memories" 查看所有记忆
  - "clear" 清空记忆
  - "exit" 退出
==================================================
请输入指令 >
```

---

## 🎯 核心特性

### 🔄 分页爬取
- 自动爬取近一个月所有通知
- 智能日期检测，遇到旧数据自动停止
- 最多爬取20页保护机制
- 实时显示爬取进度

### 🛡️ 降级机制
- API密钥检查
- 无密钥时自动降级
- 对话功能：返回检索结果
- 爬虫功能：关键词匹配
- 向量编码：文本匹配

### 💬 智能对话
- LLM常驻前端，实时对话
- 自动理解用户意图
- 从记忆库检索相关信息
- 支持流式响应（打字机效果）

---

## 🗺️ Roadmap (星辰大海)

- [x] 模块A：探路者 (Scraper Agent)
- [x] 模块B：潜水员 (Deep-Dive Agent)
- [x] 模块C：文件粉碎机 (Document Parser)
- [x] 模块D：记忆中枢 (Vector DB)
- [x] 模块E：前台接待员 (Chat Controller)
- [x] 分页爬取近一个月数据
- [x] API密钥检查和降级机制
- [ ] 多高校支持
- [ ] 语音交互接口
- [ ] 移动端APP
- [ ] 分布式部署

---

## 🤝 Contributing

欢迎任何形式的贡献！无论是提交 Issue、改进正则匹配，还是增加支持其他高校解析的 Prompt，都非常欢迎。
Please feel free to open a Pull Request. Let's build something awesome together! 🤖

<p align="center">
<i>"Don't just write code, create an Agent."</i>
</p>