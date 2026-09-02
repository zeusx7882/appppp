import { KeyStatus, Prisma } from "@prisma/client";
import { Router } from "express";
import { prisma } from "../lib/prisma";

const router = Router();

const gameSelect = {
  select: {
    appId: true,
    name: true,
  },
} as const;

/**
 * Normaliza a key com trim().toUpperCase() e mantem a variante original
 * (apenas com trim) como fallback, para keys gravadas em minusculas.
 */
const keyCandidates = (value: unknown): string[] | null => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }

  const upper = trimmed.toUpperCase();
  return upper === trimmed ? [upper] : [upper, trimmed];
};

/**
 * Loga apenas informacoes seguras (mensagem e codigo/meta do Prisma),
 * nunca DATABASE_URL, tokens ou outros segredos.
 */
const logSafeError = (scope: string, err: unknown): void => {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    console.error(`[${scope}] Prisma error`, {
      code: err.code,
      meta: err.meta,
      message: err.message,
    });
    return;
  }

  if (err instanceof Error) {
    console.error(`[${scope}] ${err.name}: ${err.message}`);
    return;
  }

  console.error(`[${scope}] Unknown error`);
};

// POST /api/keys/redeem
router.post("/redeem", async (req, res) => {
  try {
    const body = (req.body ?? {}) as {
      key?: unknown;
      discordId?: unknown;
      discordUsername?: unknown;
    };

    const candidates = keyCandidates(body.key);
    const discordId =
      typeof body.discordId === "string" && body.discordId.trim().length > 0
        ? body.discordId.trim()
        : null;
    const discordUsername =
      typeof body.discordUsername === "string" && body.discordUsername.trim().length > 0
        ? body.discordUsername.trim()
        : null;

    if (!candidates) {
      return res.status(400).json({ success: false, message: "Key inválida" });
    }

    if (!discordId) {
      return res.status(400).json({ success: false, message: "discordId inválido" });
    }

    const now = new Date();

    // Atualizacao atomica: apenas uma requisicao consegue marcar a key como USED.
    const claimed = await prisma.key.updateMany({
      where: { key: { in: candidates }, status: KeyStatus.AVAILABLE },
      data: {
        status: KeyStatus.USED,
        usedAt: now,
        usedBy: discordId,
        usedByUsername: discordUsername,
        redeemedAt: now,
      },
    });

    const record = await prisma.key.findFirst({
      where: { key: { in: candidates } },
      select: {
        usedBy: true,
        game: gameSelect,
      },
    });

    if (!record) {
      return res.status(404).json({ success: false, message: "Key não encontrada" });
    }

    if (claimed.count === 0) {
      const message =
        record.usedBy === discordId ? "Você já resgatou esta key" : "Esta key já foi utilizada";
      return res.status(400).json({ success: false, message });
    }

    return res.json({
      success: true,
      appId: record.game.appId,
      gameName: record.game.name,
      message: "Key resgatada com sucesso!",
    });
  } catch (err) {
    logSafeError("redeem", err);
    return res.status(500).json({ success: false, message: "Erro interno" });
  }
});

// GET /api/keys/activated?discordId=xxx
router.get("/activated", async (req, res) => {
  try {
    const discordId =
      typeof req.query.discordId === "string" && req.query.discordId.trim().length > 0
        ? req.query.discordId.trim()
        : null;

    if (!discordId) {
      return res.json({ games: [] });
    }

    const keys = await prisma.key.findMany({
      where: { usedBy: discordId, status: KeyStatus.USED },
      select: {
        key: true,
        redeemedAt: true,
        usedAt: true,
        game: gameSelect,
      },
      orderBy: { redeemedAt: "desc" },
    });

    return res.json({
      games: keys.map((item) => ({
        appId: item.game.appId,
        gameName: item.game.name,
        key: item.key,
        activatedAt: item.redeemedAt ?? item.usedAt,
      })),
    });
  } catch (err) {
    logSafeError("activated", err);
    return res.status(500).json({ games: [] });
  }
});

// POST /api/keys/validate
router.post("/validate", async (req, res) => {
  try {
    const candidates = keyCandidates((req.body as { key?: unknown } | undefined)?.key);
    if (!candidates) {
      return res.status(400).json({ error: "Invalid key input." });
    }

    const discordId =
      typeof (req.body as { discordId?: unknown }).discordId === "string"
        ? ((req.body as { discordId: string }).discordId.trim() || null)
        : null;
    const discordUsername =
      typeof (req.body as { discordUsername?: unknown }).discordUsername === "string"
        ? ((req.body as { discordUsername: string }).discordUsername.trim() || null)
        : null;

    const now = new Date();

    const updateResult = await prisma.key.updateMany({
      where: { key: { in: candidates }, status: KeyStatus.AVAILABLE },
      data: {
        status: KeyStatus.USED,
        usedAt: now,
        usedBy: discordId,
        usedByUsername: discordUsername,
        redeemedAt: now,
      },
    });

    const record = await prisma.key.findFirst({
      where: { key: { in: candidates } },
      select: { game: gameSelect },
    });

    if (!record) {
      return res.status(404).json({ error: "Key not found." });
    }

    if (updateResult.count === 0) {
      return res.status(400).json({ error: "Key has already been used." });
    }

    return res.json({
      success: true,
      game: {
        appId: record.game.appId,
        name: record.game.name,
      },
    });
  } catch (err) {
    logSafeError("validate", err);
    return res.status(500).json({ error: "Internal server error." });
  }
});

// POST /api/keys/check
router.post("/check", async (req, res) => {
  try {
    const candidates = keyCandidates((req.body as { key?: unknown } | undefined)?.key);
    if (!candidates) {
      return res.status(400).json({ error: "Invalid key input." });
    }

    const record = await prisma.key.findFirst({
      where: { key: { in: candidates } },
      select: {
        status: true,
        game: gameSelect,
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
        appId: record.game.appId,
        name: record.game.name,
      },
    });
  } catch (err) {
    logSafeError("check", err);
    return res.status(500).json({ error: "Internal server error." });
  }
});

export default router;
