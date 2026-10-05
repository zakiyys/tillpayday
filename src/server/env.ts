import { z } from "zod";

// Secrets have no defaults: the app refuses to start when any is missing or weak.
const secret = (name: string) =>
  z
    .string({ error: `${name} is required` })
    .min(32, `${name} must be at least 32 characters (run: npm run secrets)`)
    .refine((v) => new Set(v).size >= 10, `${name} looks weak (too few distinct characters)`)
    .refine((v) => !/^(change.?me|secret|password|example)/i.test(v), `${name} is a placeholder value`);

export const envSchema = z.object({
  DATABASE_URL: z.string().url().startsWith("postgres"),
  SETUP_TOKEN: secret("SETUP_TOKEN"),
  SESSION_SECRET: secret("SESSION_SECRET"),
  DATA_ENCRYPTION_KEY: secret("DATA_ENCRYPTION_KEY"),
  BACKUP_ENCRYPTION_KEY: secret("BACKUP_ENCRYPTION_KEY"),
  VAPID_PUBLIC_KEY: z.string().min(40, "VAPID_PUBLIC_KEY is required (run: npm run secrets)"),
  VAPID_PRIVATE_KEY: z.string().min(20, "VAPID_PRIVATE_KEY is required (run: npm run secrets)"),
  PUBLIC_URL: z.string().url(),
  DATA_DIR: z.string().min(1),
  APP_NAME: z.string().min(1).max(40),
  BACKUP_DIR: z.string().optional(),
  BACKUP_COPY_DIR: z.string().optional(),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: Record<string, string | undefined>): Env {
  const r = envSchema.safeParse(source);
  if (!r.success) {
    const lines = r.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`);
    throw new Error(`Invalid environment, refusing to start:\n${lines.join("\n")}`);
  }
  return r.data;
}

let cached: Env | undefined;
export function env(): Env {
  cached ??= parseEnv(process.env);
  return cached;
}
