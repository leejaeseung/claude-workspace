import "dotenv/config";
import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import authRouter from "./routes/auth";
import recipesRouter from "./routes/recipes";
import syncRouter from "./routes/sync";
import voiceRouter from "./routes/voice";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.use("/api/auth", authRouter);
app.use("/api/recipes", recipesRouter);
app.use("/api/sync", syncRouter);
app.use("/api/voice", voiceRouter);

// Express 5는 라우트 핸들러의 async 예외를 자동으로 next(err)로 넘기므로 별도 wrapper가 필요 없다.
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "internal_error", message: err.message });
});

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => {
  console.log(`recipe-voice-app backend listening on :${port}`);
});
