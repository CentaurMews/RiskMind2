import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import router from "./routes";
import { sendError } from "./lib/errors";
import { handleMcpRequest } from "./mcp/handler";

const app: Express = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.post("/mcp", handleMcpRequest);
app.get("/mcp", handleMcpRequest);
app.delete("/mcp", handleMcpRequest);

app.use("/api", router);

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
