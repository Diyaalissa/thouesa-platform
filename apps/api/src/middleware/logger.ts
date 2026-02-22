import pinoHttpImport from "pino-http";
import type { IncomingMessage, ServerResponse } from "http";

// pino-http CommonJS: أحياناً يأتي تحت default مع ESM
const pinoHttp = ((pinoHttpImport as any).default ?? pinoHttpImport) as any;

export const httpLogger = pinoHttp({
  redact: ["req.headers.authorization"],
  customLogLevel: (_req: IncomingMessage, res: ServerResponse, err?: Error) => {
    if (err || res.statusCode >= 500) return "error";
    if (res.statusCode >= 400) return "warn";
    return "info";
  },
});