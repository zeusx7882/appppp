import { KeyStatus } from "@prisma/client";
import { Router } from "express";
import { prisma } from "../lib/prisma";

const router = Router();

const extractKey = (body: unknown): string | null => {
  if (!body || typeof body !== "object") {
    return null;
  }

  const key = (body as { key?: unknown }).key;
  if (typeof key !== "string") {
    return null;
  }

  const normalized = key.trim();
  return normalized.length > 0 ? normalized : null;
};

router.post("/validate", async (req, res) => {
  try {
    const inputKey = extractKey(req.body);
    if (!inputKey) {
      return res.status(400).json({ error: "Invalid key input." });
    }

    const now = new Date();

    const result = await prisma.$transaction(async (tx) => {
      const updateResult = await tx.key.updateMany({
        where: {
          key: inputKey,
          status: KeyStatus.AVAILABLE,
        },
        data: {
          status: KeyStatus.USED,
          usedAt: now,
        },
      });

      const record = await tx.key.findUnique({
        where: { key: inputKey },
        select: {
          gameAppId: true,
          gameName: true,
          status: true,
        },
      });

      return {
        updateCount: updateResult.count,
        record,
      };
    });

    if (!result.record) {
      return res.status(404).json({ error: "Key not found." });
    }

    if (result.updateCount === 0) {
      return res.status(400).json({ error: "Key has already been used." });
    }

    return res.json({
      success: true,
      game: {
        appId: result.record.gameAppId,
        name: result.record.gameName,
      },
    });
  } catch {
    return res.status(500).json({ error: "Internal server error." });
  }
});

router.post("/check", async (req, res) => {
  try {
    const inputKey = extractKey(req.body);
    if (!inputKey) {
      return res.status(400).json({ error: "Invalid key input." });
    }

    const record = await prisma.key.findUnique({
      where: { key: inputKey },
      select: {
        gameAppId: true,
        gameName: true,
        status: true,
      },
    });

    if (!record) {
      return res.status(404).json({
        exists: false,
        valid: false,
      });
    }

    return res.json({
      exists: true,
      valid: record.status === KeyStatus.AVAILABLE,
      status: record.status,
      game: {
        appId: record.gameAppId,
        name: record.gameName,
      },
    });
  } catch {
    return res.status(500).json({ error: "Internal server error." });
  }
});

export default router;
