import { parseEnv } from "./env";

try {
  parseEnv(process.env);
} catch (e) {
  console.error((e as Error).message);
  process.exit(1);
}
