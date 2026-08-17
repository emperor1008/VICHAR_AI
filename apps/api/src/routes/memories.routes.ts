import { Router } from "express";
import { asyncH, audit } from "../security.js";
import { requireAuth, AuthedRequest } from "../auth.js";
import { deleteMemory, listMemories } from "../memory.js";

const router = Router();
router.use(requireAuth);

router.get("/", asyncH(async (req: AuthedRequest, res) => {
  res.json({ memories: listMemories(req.user!.id) });
}));

router.delete("/:id", asyncH(async (req: AuthedRequest, res) => {
  const ok = deleteMemory(req.user!.id, req.params.id);
  if (ok) audit(req.user!.id, "memory.deleted", req);
  res.json({ ok });
}));

export default router;
