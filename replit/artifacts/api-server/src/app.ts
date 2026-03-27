import express, { type Express } from "express";
import cors from "cors";
import compression from "compression";
import router from "./routes";
import { registerYmsRoutes } from "./lib/register-yms-routes";

const app: Express = express();

app.use(compression());
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

registerYmsRoutes(app);

export default app;
