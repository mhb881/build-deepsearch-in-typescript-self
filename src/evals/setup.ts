import "dotenv/config";
import { runProxy } from "~/lib/proxy";

// ⭐️ 在评测测试启动时，立刻激活网络代理，确保 Google Gemini 与网络抓取正常访问
runProxy();
