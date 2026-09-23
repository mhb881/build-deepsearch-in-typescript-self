// 导入 Redis 缓存高阶函数，用于为异步函数添加缓存能力
// 相同请求参数会先查 Redis 缓存，命中则直接返回，未命中才发起网络请求并存入缓存
import { cacheWithRedis } from "~/server/redis/redis";

/**
 * Serper API（Google 搜索 API 服务 https://serper.dev）的类型定义
 *
 * 使用 declare namespace 声明纯类型，仅用于编译时类型检查，不生成运行时代码
 */
export declare namespace SerperTool {
  /** 搜索请求参数：q 为搜索关键词，num 为返回结果数量 */
  export type SearchInput = {
    q: string;
    num: number;
  };

  /** 响应中的搜索参数回显：查询词、搜索类型、搜索引擎 */
  export interface SearchParameters {
    q: string;
    type: string;
    engine: string;
  }

  /** Google 知识图谱信息：标题、类型、评分、评分人数、图片 URL、属性键值对 */
  export interface KnowledgeGraph {
    title: string;
    type: string;
    rating?: number;
    ratingCount?: number;
    imageUrl?: string;
    attributes?: Record<string, string>;
  }

  /** 搜索结果下的子链接：标题 + 链接 */
  export interface Sitelink {
    title: string;
    link: string;
  }

  /** 自然搜索结果：标题、链接、摘要（snippet）、子链接、排名位置、日期 */
  export interface OrganicResult {
    title: string;
    link: string;
    snippet: string;
    sitelinks?: Sitelink[];
    position: number;
    date?: string;
  }

  /** "人们还问了"模块：问题、摘要、标题、链接 */
  export interface PeopleAlsoAskResult {
    question: string;
    snippet: string;
    title: string;
    link: string;
  }

  /** 相关搜索：查询词 */
  export interface RelatedSearch {
    query: string;
  }

  /** 完整响应体：搜索参数、知识图谱、自然结果列表、人们还问、相关搜索、API 额度消耗 */
  export interface SearchResult {
    searchParameters: SearchParameters;
    knowledgeGraph?: KnowledgeGraph;
    organic: OrganicResult[];
    peopleAlsoAsk?: PeopleAlsoAskResult[];
    relatedSearches?: RelatedSearch[];
    credits: number;
  }
}

/**
 * 带缓存的 Serper API 请求函数
 *
 * 通过 cacheWithRedis 包装，以 "serper" 作为缓存键前缀
 * 相同的 url + options 参数会复用 Redis 缓存，避免重复调用 API
 *
 * 参数类型 Omit<RequestInit, "headers"> & { signal } 表示：
 * - 接受标准 RequestInit 的所有属性除了 headers（headers 由函数内部固定设置）
 * - 额外要求 signal 字段，支持请求取消（如用户中途取消搜索时中断网络请求）
 */
const fetchFromSerper = cacheWithRedis(
  "serper",
  async (
    url: string,
    options: Omit<RequestInit, "headers"> & { signal: AbortSignal | undefined },
  ): Promise<SerperTool.SearchResult> => {
    // 环境变量检查：如果 SERPER_API_KEY 未设置，直接抛出错误，避免发出无效请求
    if (!process.env.SERPER_API_KEY) {
      throw new Error("SERPER_API_KEY is not set in .env");
    }

    // 向 Serper API 发起请求：基础 URL + 传入的路径
    // headers 中设置 X-API-KEY（Serper 认证方式）和 Content-Type
    // signal 支持请求取消
    const response = await fetch(`https://google.serper.dev${url}`, {
      ...options,
      headers: {
        "X-API-KEY": process.env.SERPER_API_KEY,
        "Content-Type": "application/json",
      },
      signal: options.signal,
    });

    // 错误处理：响应状态码非 2xx 时，抛出响应体文本作为错误信息
    if (!response.ok) {
      throw new Error(await response.text());
    }

    // 解析 JSON 响应并返回
    const json = await response.json();

    return json;
  },
);

/**
 * 对外暴露的搜索函数：调用 Serper API 进行 Google 搜索
 *
 * @param body - 搜索请求体，包含 q（查询词）和 num（结果数量）
 * @param signal - 可选的取消信号，用于中断请求（如用户取消搜索时）
 * @returns SerperTool.SearchResult，包含搜索结果的所有信息
 *
 * 调用链：searchSerper → fetchFromSerper（带缓存）→ fetch（实际网络请求）
 */
export const searchSerper = async (
  body: SerperTool.SearchInput,
  signal: AbortSignal | undefined,
) => {
  // 调用 fetchFromSerper，向 /search 端点发送 POST 请求
  // 将 body 序列化为 JSON 字符串作为请求体
  const results = await fetchFromSerper(`/search`, {
    method: "POST",
    body: JSON.stringify(body),
    signal,
  });

  return results;
};
