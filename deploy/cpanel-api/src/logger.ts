import pino from "pino";

const isProd = process.env.NODE_ENV === "production";

let transport: any = undefined;

// لا تجعل التطبيق يعتمد على pino-pretty إطلاقاً في الإنتاج
if (!isProd) {
  try {
    transport = pino.transport({
      target: "pino-pretty",
      options: { colorize: true, translateTime: "SYS:standard", ignore: "pid,hostname" },
    });
  } catch {
    transport = undefined; // إذا pino-pretty غير موجود، لا تسقط العملية
  }
}

export const logger = pino(
  { level: isProd ? "info" : "debug" },
  transport
);