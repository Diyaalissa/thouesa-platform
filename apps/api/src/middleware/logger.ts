import pinoHttp from "pino-http";

export const logger = pinoHttp({
  redact: ["req.headers.authorization"],
  customLogLevel: function (_req, res, err) {
    if (res.statusCode >= 500 || err) return "error";
    if (res.statusCode >= 400) return "warn";
    return "info";
  },
});
