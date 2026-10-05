// Finds private details that must never reach a public repo.
// Extra deny patterns (owner name, email, domain, hostname) live in deploy.local/private-patterns.txt,
// one regex per line. That file is gitignored, so the patterns themselves never get committed.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const staged = process.argv.includes("--staged");
const git = (...args) => execFileSync("git", args, { encoding: "utf8", maxBuffer: 1 << 30 });

const allowedHosts = new Set(
  readFileSync("scripts/allowed-hosts.txt", "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#")),
);
const allowedIps = new Set(["127.0.0.1", "0.0.0.0", "255.255.255.255", "10.0.0.0", "192.168.0.0", "172.16.0.0"]);

const extra = existsSync("deploy.local/private-patterns.txt")
  ? readFileSync("deploy.local/private-patterns.txt", "utf8")
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#"))
      .map((l) => new RegExp(l, "i"))
  : [];

const ipRe = /(?<![\d.])(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})(?![\d.])/g;
const pathRe = /(?:^|[\s"'`(=:])(\/(?:data|home|root|Users|srv|opt\/[a-z]+|var\/www)\/[\w.-]+)/g;
// Host names: require a URL scheme, an "@" or a leading "//" so file names like start.sh are not flagged,
// plus bare names under common public TLDs that are rarely file extensions.
const hostRe = /(?:(?:https?|wss?|ftp):\/\/|\/\/)((?:[a-z0-9-]+\.)+[a-z]{2,})|\b((?:[a-z0-9-]+\.)+(?:com|net|org|online|site|cloud|xyz|lol|tech|biz|info|space|app|dev|io))\b/gi;
const emailRe = /\b[\w.+-]+@([\w-]+\.)+[a-z]{2,}\b/gi;

function hostAllowed(h) {
  h = h.toLowerCase();
  // RFC 2606/6761 reserved names never resolve and cannot point at a real host.
  if (/\.(invalid|test|example|localhost)$/.test(h) || h === "localhost") return true;
  for (const a of allowedHosts) if (h === a || h.endsWith("." + a)) return true;
  return false;
}

function scanLine(where, line) {
  const hits = [];
  for (const m of line.matchAll(ipRe)) {
    const parts = m.slice(1, 5).map(Number);
    if (parts.some((p) => p > 255)) continue;
        if (!allowedIps.has(m[0])) hits.push(`ip ${m[0]}`);
  }
  for (const m of line.matchAll(pathRe)) hits.push(`path ${m[1]}`);
  for (const m of line.matchAll(hostRe)) {
    const h = m[1] ?? m[2];
    if (/\.(ts|tsx|js|mjs|json|md|sh|css|yml|yaml|toml|prisma|png|webp|woff2|txt|html|env|io\.ts)$/i.test(h) && !m[1]) continue;
    // Bare (scheme-less) matches: code like `navigator.onLine` is camelCase; real host names are lower case.
    if (!m[1] && h !== h.toLowerCase()) continue;
    if (!hostAllowed(h)) hits.push(`host ${h}`);
  }
  for (const m of line.matchAll(emailRe)) {
    const domain = m[0].split("@")[1].toLowerCase();
    if (!/(example\.(invalid|com|org|net)|users\.noreply\.github\.com)$/.test(domain)) hits.push(`email ${m[0]}`);
  }
  for (const re of extra) if (re.test(line)) hits.push(`private pattern ${re.source}`);
  return hits.map((h) => `${where}: ${h}`);
}

const SKIP = /(^|\/)(package-lock\.json|public\/fonts\/|scripts\/allowed-hosts\.txt$|docs\/SPEC\.md$)/;
const findings = new Set();

if (staged) {
  const diff = git("diff", "--cached", "--unified=0", "--no-color");
  let file = "";
  for (const line of diff.split("\n")) {
    if (line.startsWith("+++ ")) file = line.slice(6);
    else if (line.startsWith("+") && !SKIP.test(file)) for (const f of scanLine(file, line.slice(1))) findings.add(f);
  }
} else {
  const revs = git("rev-list", "--all").split("\n").filter(Boolean);
  for (const rev of revs) {
    const files = git("ls-tree", "-r", "--name-only", rev).split("\n").filter((f) => f && !SKIP.test(f));
    for (const f of files) {
      let content;
      try {
        content = git("show", `${rev}:${f}`);
      } catch {
        continue;
      }
      if (content.includes("\u0000")) continue;
      content.split("\n").forEach((line, i) => {
        for (const hit of scanLine(`${f}:${i + 1}`, line)) findings.add(hit);
      });
    }
  }
  const meta = git("log", "--all", "--format=%H%x09%an <%ae>%x09%cn <%ce>%x09%B");
  meta.split("\n").forEach((line, i) => {
    for (const hit of scanLine(`commit-meta:${i + 1}`, line)) findings.add(hit);
  });
}

if (findings.size) {
  console.error("Private details found:\n" + [...findings].map((f) => "  " + f).join("\n"));
  process.exit(1);
}
console.log(`private scan (${staged ? "staged" : "full history"}): clean`);
