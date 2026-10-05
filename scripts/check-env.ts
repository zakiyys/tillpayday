// Fails fast (exit 1) when required secrets are missing or weak.
import { parseEnv } from "../src/server/env";

try {
  parseEnv(process.env);
  console.log("environment: ok");
} catch (e) {
  console.error((e as Error).message);
  process.exit(1);
}
