import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import path from "path";
import router from "./routes";
import { sendError } from "./lib/errors";
import { handleMcpRequest } from "./mcp/handler";

const app: Express = express();

const ALLOWED_ORIGINS = [
  "https://app.riskmind.net",
  "http://localhost:4000",
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
}));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.post("/mcp", handleMcpRequest);
app.get("/mcp", handleMcpRequest);
app.delete("/mcp", handleMcpRequest);

app.use("/api", router);

// Serve built React SPA from the artifacts/riskmind-app/dist/public/ directory
// Path resolves correctly from compiled dist/index.cjs location: artifacts/api-server/dist/
const spaDistPath = path.resolve(__dirname, "../../riskmind-app/dist/public");

app.use(express.static(spaDistPath));

// SPA fallback: any non-/api, non-/mcp path returns index.html
// This must come AFTER express.static so static assets are served directly
app.get(/^(?!\/api|\/mcp).*$/, (_req: Request, res: Response) => {
  res.sendFile(path.join(spaDistPath, "index.html"));
});

app.use((_req: Request, res: Response) => {
  sendError(res, 404, "Not Found", "The requested endpoint does not exist");
});

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err && typeof err === "object" && "type" in err && (err as Record<string, unknown>).type === "entity.parse.failed") {
    sendError(res, 400, "Bad Request", "Invalid JSON in request body");
    return;
  }
  console.error("Unhandled error:", err);
  sendError(res, 500, "Internal Server Error", "An unexpected error occurred");
});

export default app;
