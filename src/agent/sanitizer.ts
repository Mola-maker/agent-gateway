// src/agent/sanitizer.ts
export function sanitizeUrl(url: string | undefined): string {
  if (!url) return '';
  let cleaned = url.trim();

  // 1. 剥离 Markdown 链接陷阱 [text](url)
  const mdMatch = cleaned.match(/\[.*\]\((.*)\)/);
  if (mdMatch) cleaned = mdMatch[1];

  // 2. 剥离大模型爱用的 Markdown 代码块包裹 (```text ... ```)
  cleaned = cleaned.replace(/```[a-z]*\n?/g, '').replace(/```/g, '');

  // 3. 绞肉机：强行剥离首尾的任何反引号(`)、单引号(')、双引号(")和空白符
  cleaned = cleaned.replace(/^[`"'\s]+|[`"'\s]+$/g, '');

  return cleaned;
}
export function wrapExternalContent(text: string): string {
  return `<<<EXTERNAL_UNTRUSTED_CONTENT_START>>>\n${text}\n<<<EXTERNAL_UNTRUSTED_CONTENT_END>>>`;
}

/**
 * 清洗 HTML 内容，效仿 OpenClaw 的 Content Sanitization
 * 移除脚本、样式、广告等噪音，降低 Token 消耗
 */
export function cleanHtmlText(rawText: string): string {
  return rawText
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 10000); // 强行截断，防止爆 Token
}