import { ProxyAgent, setGlobalDispatcher } from "undici";

const v2rayProxy = "http://127.0.0.1:10808";
const clashProxy = "http://127.0.0.1:7897";

export const runProxy = () => {
  // 配置代理
  const proxyUrl =
    process.env.HTTPS_PROXY || process.env.HTTP_PROXY || clashProxy;
  if (proxyUrl) {
    setGlobalDispatcher(new ProxyAgent(proxyUrl));
    console.log(`[Proxy] Using proxy: ${proxyUrl}`);
  }
};
