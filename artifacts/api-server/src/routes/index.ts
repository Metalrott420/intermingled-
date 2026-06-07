import { Router, type IRouter } from "express";
import healthRouter from "./health";
import roomsRouter from "./rooms";
import usersRouter from "./users";
import stripeRouter from "./stripe";
import storageRouter from "./storage";
import profileRouter from "./profile";
import dmRouter from "./dm";

const router: IRouter = Router();

router.use(healthRouter);
router.use(usersRouter);
router.use(roomsRouter);
router.use(stripeRouter);
router.use(storageRouter);
router.use(profileRouter);
router.use(dmRouter);

export default router;
