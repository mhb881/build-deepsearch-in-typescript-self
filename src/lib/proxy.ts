import { ProxyAgent, setGlobalDispatcher } from "undici";

export const runProxy = () => {
  // 配置代理
  const proxyUrl =
    process.env.HTTPS_PROXY ||
    process.env.HTTP_PROXY ||
    "http://127.0.0.1:10808";
  if (proxyUrl) {
    setGlobalDispatcher(new ProxyAgent(proxyUrl));
    console.log(`[Proxy] Using proxy: ${proxyUrl}`);
  }
};
