import express, { type Express } from "express";
import cors from "cors";
import router from "./routes";

const app: Express = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

app.use((_req, res) => {
  res.status(404).json({
    type: "https://riskmind.app/errors/not-found",
    title: "Not Found",
    status: 404,
    detail: "The requested endpoint does not exist",
  });
});

export default app;
