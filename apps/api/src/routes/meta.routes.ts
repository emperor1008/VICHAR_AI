import { Router } from "express";
import { asyncH } from "../security.js";
import { requireAuth, AuthedRequest } from "../auth.js";
import { PERSONALITIES } from "../data/personalities.js";
import { VOICES, AVATARS } from "../data/voices.js";
import { AFFIRMATIONS, GROUNDING_EXERCISES, MEDITATION_PROMPTS } from "../data/content.js";
import { CRISIS_RESOURCES } from "../data/crisis.js";
import { pickStable } from "../utils.js";

const router = Router();
router.use(requireAuth);

router.get("/companions", asyncH(async (_req: AuthedRequest, res) => {
  res.json({ personalities: PERSONALITIES });
}));

router.get("/voices", asyncH(async (_req: AuthedRequest, res) => {
  res.json({ voices: VOICES, avatars: AVATARS });
}));

router.get("/affirmation", asyncH(async (req: AuthedRequest, res) => {
  const date = new Date().toISOString().slice(0, 10);
  res.json({ affirmation: pickStable(AFFIRMATIONS, `${req.user!.id}|${date}`) });
}));

router.get("/exercises", asyncH(async (_req: AuthedRequest, res) => {
  res.json({ exercises: GROUNDING_EXERCISES });
}));

router.get("/meditations", asyncH(async (_req: AuthedRequest, res) => {
  res.json({ meditations: MEDITATION_PROMPTS });
}));

router.get("/crisis/:countryCode?", asyncH(async (req: AuthedRequest, res) => {
  const code = (req.params.countryCode ?? "GLOBAL").toUpperCase();
  const found = CRISIS_RESOURCES.find((r) => r.countryCode === code) ?? CRISIS_RESOURCES[CRISIS_RESOURCES.length - 1];
  res.json({ resource: found, all: CRISIS_RESOURCES });
}));

export default router;
