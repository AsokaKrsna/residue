import { scan, stats } from "../engine/engine";
import type { Config, Region } from "../engine/types";

self.onmessage = (event: MessageEvent<{ text: string; config: Config; extra: Region[] }>) => {
  const { text, config, extra } = event.data;
  const start = performance.now();
  try {
    const result = scan(text, config, extra);
    self.postMessage({ result, stats: stats(text, result.findings), ms: performance.now() - start });
  } catch (error) {
    self.postMessage({ error: String(error) });
  }
};
