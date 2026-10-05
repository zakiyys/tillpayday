import { prisma } from "../db";
import type { Capabilities } from "./provider";

/** For the input bar indicator (SPEC 7.7): off = not configured, down = last test failed, novision = no image reading. */
export async function aiStateFor(householdId: string): Promise<"off" | "ok" | "down" | "novision"> {
  const c = await prisma.aiConfig.findUnique({ where: { householdId } });
  if (!c) return "off";
  const caps = (c.capabilities ?? {}) as Capabilities;
  if (caps.ok === false) return "down";
  if (caps.vision === false) return "novision";
  return "ok";
}
