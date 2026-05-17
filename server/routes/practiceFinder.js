/**
 * @deprecated Prefer /api/places/search — kept for backward compatibility.
 */

import express from "express";
import placesRouter from "./places.js";

const router = express.Router();

router.use("/", placesRouter);

export default router;
