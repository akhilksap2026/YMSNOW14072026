import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import meRouter from "./me";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/me", meRouter);

export default router;
