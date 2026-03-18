// src/agent/sanitizer.ts
export function sanitizeUrl(url: string | undefined): string {
  if (!url) return '';
  let cleaned = url.trim();
  // 修复 Markdown 复制陷阱 [url](url)
  const mdMatch = cleaned.match(/\[.*\]\((.*)\)/);
  if (mdMatch) cleaned = mdMatch[1];
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