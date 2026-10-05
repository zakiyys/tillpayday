// Prints fresh random secrets in .env format. Usage: npm run secrets >> .env
import { randomBytes } from "node:crypto";
import webpush from "web-push";

const r = () => randomBytes(32).toString("base64url");
const vapid = webpush.generateVAPIDKeys();

console.log(
  [
    `SETUP_TOKEN=${r()}`,
    `SESSION_SECRET=${r()}`,
    `DATA_ENCRYPTION_KEY=${r()}`,
    `BACKUP_ENCRYPTION_KEY=${r()}`,
    `VAPID_PUBLIC_KEY=${vapid.publicKey}`,
    `VAPID_PRIVATE_KEY=${vapid.privateKey}`,
  ].join("\n"),
);
