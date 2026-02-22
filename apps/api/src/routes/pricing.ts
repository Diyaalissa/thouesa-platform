import { Router } from "express";
import { PricingService } from "../services/pricing.service.ts";

export const pricingRouter = Router();

pricingRouter.get("/estimate", async (req, res, next) => {
  try {
    const weight = parseFloat(req.query.weight as string);
    const direction = req.query.direction as "JO_TO_DZ" | "DZ_TO_JO";

    if (isNaN(weight) || !direction) {
      return res.status(400).json({ success: false, error: "INVALID_PARAMS" });
    }

    const estimate = await PricingService.calculatePrice(weight, direction);
    res.json({ success: true, data: estimate });
  } catch (error: any) {
    next(error);
  }
});