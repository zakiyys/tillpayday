import { randomBytes } from "node:crypto";

// Random per run so no secret-shaped literal ever lands in the repo.
export const fakeSecret = () => randomBytes(32).toString("base64url");
