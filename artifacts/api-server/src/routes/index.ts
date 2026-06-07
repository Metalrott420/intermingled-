import { Router, type IRouter } from "express";
import healthRouter from "./health";
import roomsRouter from "./rooms";
import usersRouter from "./users";
import stripeRouter from "./stripe";

const router: IRouter = Router();

router.use(healthRouter);
router.use(usersRouter);
router.use(roomsRouter);
router.use(stripeRouter);

export default router;
