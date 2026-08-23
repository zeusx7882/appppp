import "dotenv/config";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import { env } from "./config/env";
import { prisma } from "./lib/prisma";
import keysRouter from "./routes/keys";

const app = express();

app.disable("x-powered-by");
app.use(cors());
app.use(express.json({ limit: "16kb" }));

app.get(["/", "/health"], (_req, res) => {
  res.json({
    ok: true,
    service: "freedrop-keys-api",
  });
});

app.use("/api/keys", keysRouter);

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof SyntaxError) {
    return res.status(400).json({ error: "Invalid JSON payload." });
  }

  return res.status(500).json({ error: "Internal server error." });
});

const server = app.listen(env.PORT, () => {
  console.log(`API listening on port ${env.PORT}`);
});

const shutdown = async () => {
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
