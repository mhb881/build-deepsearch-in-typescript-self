/*
Next.js 启动的时候就会执行：
.env.local
    ↓
HTTPS_PROXY=http://127.0.0.1:10808

instrumentation.ts
    ↓
ProxyAgent
    ↓
setGlobalDispatcher()
    ↓
Node.js/Undici fetch
    ↓
Better Auth
    ↓
Discord
 */

import { runProxy } from "./lib/proxy";

runProxy();
