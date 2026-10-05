// Minimal OpenAI chat-completions compatible server for e2e (owner brief: mock model in tests).
// Listens on 127.0.0.1:3071. Replies with fixed actions for a few inputs from SPEC 7.4.
import http from "node:http";

const reply = (actions) => ({ id: "mock", object: "chat.completion", choices: [{ index: 0, message: { role: "assistant", content: JSON.stringify({ actions }) }, finish_reason: "stop" }] });
const nulls = (o) => o;

http
  .createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      if (req.url === "/health") {
        res.writeHead(200).end("ok");
        return;
      }
      if (req.method !== "POST" || !req.url.endsWith("/chat/completions")) {
        res.writeHead(404).end();
        return;
      }
      const j = JSON.parse(body || "{}");
      const sys = j.messages?.find((m) => m.role === "system")?.content ?? "";
      if (/set up a personal finance app/.test(sys)) {
        const u = j.messages?.find((m) => m.role === "user")?.content ?? "";
        const patch = /Current topic: basics/.test(sys) ? { basics: { baseCurrency: "IDR", timezone: "Asia/Jakarta" } } : /Current topic: accounts/.test(sys) ? { accounts: [{ name: "Bank Wawancara", type: "BANK", institution: "Bank W", balance: "2500000" }] } : {};
        void u;
        res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ choices: [{ index: 0, message: { role: "assistant", content: JSON.stringify({ patch, skip: false, next_question: null }) } }] }));
        return;
      }
      const user = j.messages?.find((m) => m.role === "user")?.content;
      const text = typeof user === "string" ? user : (user?.find?.((p) => p.type === "text")?.text ?? "");
      let actions = [{ intent: "clarify", question: "ok", options: [], unknown: [] }];
      if (/trf ke teman/i.test(text)) actions = [{ intent: "record_transfer", amount: "100000", from_account: "Bank Contoh", to: "teman", unknown: [] }];
      if (/makan habis berapa|spend on food/i.test(text)) actions = [{ intent: "query", function: "spend_by_category", args: { category: "makan" }, unknown: [] }];
      res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(reply(nulls(actions))));
    });
  })
  .listen(3071, "127.0.0.1");
