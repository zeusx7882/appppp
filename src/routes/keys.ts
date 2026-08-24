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

// POST /api/keys/redeem
router.post("/redeem", async (req, res) => {
  try {
    const body = req.body as { key?: unknown; discordId?: unknown; discordUsername?: unknown };
    const rawKey = typeof body.key === "string" ? body.key.trim().toUpperCase() : null;
    const discordId = typeof body.discordId === "string" ? body.discordId.trim() : null;
    const discordUsername =
      typeof body.discordUsername === "string" ? body.discordUsername.trim() : null;

    if (!rawKey || !discordId) {
      return res.status(400).json({ success: false, message: "Parâmetros inválidos." });
    }

    const existing = await prisma.key.findUnique({ where: { key: rawKey } });

    if (!existing) {
      return res.status(404).json({ success: false, message: "Key não encontrada." });
    }

    if (existing.status === KeyStatus.USED) {
      const msg =
        existing.usedBy === discordId
          ? "Você já resgatou esta key"
          : "Esta key já foi utilizada";
      return res.status(400).json({ success: false, message: msg });
    }

    const now = new Date();

    const updated = await prisma.key.updateMany({
      where: { key: rawKey, status: KeyStatus.AVAILABLE },
      data: {
        status: KeyStatus.USED,
        usedAt: now,
        usedBy: discordId,
        usedByUsername: discordUsername,
        redeemedAt: now,
      },
    });

    if (updated.count === 0) {
      // Race condition: another request claimed the key between our read and update.
      const fresh = await prisma.key.findUnique({ where: { key: rawKey } });
      if (!fresh) {
        return res.status(404).json({ success: false, message: "Key não encontrada." });
      }
      const msg =
        fresh.usedBy === discordId
          ? "Você já resgatou esta key"
          : "Esta key já foi utilizada";
      return res.status(400).json({ success: false, message: msg });
    }

    return res.json({
      success: true,
      appId: existing.gameAppId,
      gameName: existing.gameName,
      message: "Key resgatada com sucesso!",
    });
  } catch (err) {
    console.error("[redeem]", err);
    return res.status(500).json({ success: false, message: "Erro interno" });
  }
});

// GET /api/keys/activated?discordId=xxx
router.get("/activated", async (req, res) => {
  try {
    const discordId =
      typeof req.query.discordId === "string" ? req.query.discordId.trim() : null;

    if (!discordId) {
      return res.json({ games: [] });
    }

    const keys = await prisma.key.findMany({
      where: { usedBy: discordId, status: KeyStatus.USED },
      select: {
        key: true,
        gameAppId: true,
        gameName: true,
        redeemedAt: true,
      },
      orderBy: { redeemedAt: "desc" },
    });

    return res.json({
      games: keys.map((k) => ({
        appId: k.gameAppId,
        gameName: k.gameName,
        key: k.key,
        activatedAt: k.redeemedAt,
      })),
    });
  } catch (err) {
    console.error("[activated]", err);
    return res.status(500).json({ games: [] });
  }
});

// POST /api/keys/validate
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

// POST /api/keys/check
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
