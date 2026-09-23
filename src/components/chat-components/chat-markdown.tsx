"use client";

import { useState } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { Check, Copy } from "lucide-react";

/**
 * 代码块组件：
 * 1. 自动区分行内代码 (Inline Code) 与独立代码块 (Code Block)
 * 2. 独立代码块展示语言 Tag、横向滚动条以及一键复制按钮
 */
function CodeBlock({
  className,
  children,
  ...props
}: React.ComponentPropsWithoutRef<"code">) {
  const [copied, setCopied] = useState(false);
  const match = /language-(\w+)/.exec(className ?? "");
  const language = match ? match[1] : "";
  const codeText = String(children).replace(/\n$/, "");

  // 没有显式声明语言且内容不包含换行符，视为行内代码 (inline code)
  const isInline = !match && !codeText.includes("\n");

  if (isInline) {
    return (
      <code
        className="rounded-md bg-gray-100 px-1.5 py-0.5 font-mono text-[0.85em] font-medium text-gray-800 dark:bg-gray-800 dark:text-gray-200"
        {...props}
      >
        {children}
      </code>
    );
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(codeText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("复制代码失败:", err);
    }
  };

  return (
    <div className="group relative my-3 overflow-hidden rounded-xl border border-gray-200 bg-gray-950 text-gray-100 dark:border-gray-800">
      {/* 顶部工具栏 */}
      <div className="flex items-center justify-between border-b border-gray-800/80 bg-gray-900/90 px-3.5 py-1.5 text-xs text-gray-400">
        <span className="font-mono text-[11px] font-semibold tracking-wider text-gray-300 uppercase">
          {language || "code"}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 rounded px-2 py-0.5 text-xs text-gray-400 transition-colors hover:bg-gray-800 hover:text-gray-100"
          title="复制代码"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-emerald-400">已复制</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              <span className="cursor-pointer">复制</span>
            </>
          )}
        </button>
      </div>

      {/* 代码内容区域 */}
      <pre className="overflow-x-auto p-4 font-mono text-xs leading-relaxed text-gray-200">
        <code className={className} {...props}>
          {children}
        </code>
      </pre>
    </div>
  );
}

const components: Components = {
  // ─── 标题系统 ───
  h1: ({ children }) => (
    <h1 className="mt-6 mb-4 text-xl font-bold tracking-tight text-gray-900 first:mt-0 dark:text-gray-100">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="mt-5 mb-3 text-lg font-semibold tracking-tight text-gray-900 first:mt-0 dark:text-gray-100">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-4 mb-2 text-base font-semibold text-gray-900 first:mt-0 dark:text-gray-100">
      {children}
    </h3>
  ),
  h4: ({ children }) => (
    <h4 className="mt-3 mb-2 text-sm font-semibold text-gray-900 first:mt-0 dark:text-gray-100">
      {children}
    </h4>
  ),

  // ─── 段落与排版 ───
  p: ({ children }) => (
    <p className="mb-3 leading-relaxed text-gray-800 last:mb-0 dark:text-gray-200">
      {children}
    </p>
  ),

  // ─── 列表系统 ───
  ul: ({ children }) => (
    <ul className="mb-3 list-disc space-y-1 pl-5 text-gray-800 last:mb-0 dark:text-gray-200">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-3 list-decimal space-y-1 pl-5 text-gray-800 last:mb-0 dark:text-gray-200">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,

  // ─── 引用块 ───
  blockquote: ({ children }) => (
    <blockquote className="my-3 border-l-4 border-blue-500/80 bg-blue-50/40 py-2 pl-4 text-gray-700 italic dark:border-blue-400 dark:bg-blue-950/20 dark:text-gray-300">
      {children}
    </blockquote>
  ),

  // ─── 分割线 ───
  hr: () => (
    <hr className="my-5 border-t border-gray-200 dark:border-gray-800" />
  ),

  // ─── 链接 ───
  a: ({ children, href, ...props }) => (
    <a
      href={href}
      className="font-medium text-blue-600 underline underline-offset-2 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
      target="_blank"
      rel="noopener noreferrer"
      {...props}
    >
      {children}
    </a>
  ),

  // ─── 代码与预格式化（交由 CodeBlock 统一处理） ───
  code: CodeBlock,
  pre: ({ children }) => <>{children}</>,

  // ─── GFM 表格系统 ───
  table: ({ children }) => (
    <div className="my-4 overflow-x-auto rounded-lg border border-gray-300 dark:border-gray-800">
      <table className="m-0 min-w-full divide-y divide-gray-200 text-xs dark:divide-gray-800">
        {children}
      </table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-gray-50 dark:bg-gray-900/80">{children}</thead>
  ),
  tbody: ({ children }) => (
    <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-800 dark:bg-gray-950">
      {children}
    </tbody>
  ),
  tr: ({ children }) => (
    <tr className="transition-colors hover:bg-gray-50/60 dark:hover:bg-gray-900/50">
      {children}
    </tr>
  ),
  th: ({ children }) => (
    <th className="px-3.5 py-2 text-left font-semibold text-gray-900 dark:text-gray-100">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-3.5 py-2 text-gray-700 dark:text-gray-300">{children}</td>
  ),

  // ─── GFM 删除线 ───
  del: ({ children }) => (
    <del className="text-gray-500 line-through dark:text-gray-400">
      {children}
    </del>
  ),

  // ─── GFM 任务列表复选框 ───
  input: ({ type, checked, ...props }) => {
    if (type === "checkbox") {
      return (
        <input
          type="checkbox"
          checked={checked}
          readOnly
          className="mr-1.5 h-3.5 w-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
          {...props}
        />
      );
    }
    return <input type={type} checked={checked} {...props} />;
  },
};

export const Markdown = ({ children }: { children: string }) => {
  return (
    <div className="chat-markdown text-sm leading-relaxed wrap-break-word">
      <ReactMarkdown
        components={components}
        remarkPlugins={[remarkGfm]} // ⭐️ 开启 GitHub Flavored Markdown（表格、删除线、任务列表）
        rehypePlugins={[rehypeRaw]} // ⭐️ 开启原生 HTML 标签解析
      >
        {children}
      </ReactMarkdown>
    </div>
  );
};
