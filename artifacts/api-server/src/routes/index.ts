import { Router, type IRouter } from "express";
import healthRouter from "./health";
import roomsRouter from "./rooms";
import usersRouter from "./users";
import stripeRouter from "./stripe";
import storageRouter from "./storage";
import profileRouter from "./profile";
import dmRouter from "./dm";
import socialRouter from "./social";
import historyRouter from "./history";
import adminRouter from "./admin";
import identityRouter from "./identity";
import entitlementRouter from "./entitlement";
import eventsRouter from "./events";

const router: IRouter = Router();

router.use(healthRouter);
router.use(usersRouter);
router.use(roomsRouter);
router.use(stripeRouter);
router.use(storageRouter);
router.use(profileRouter);
router.use(dmRouter);
router.use(socialRouter);
router.use(historyRouter);
router.use(adminRouter);
router.use(identityRouter);
router.use(entitlementRouter);
router.use(eventsRouter);

export default router;
