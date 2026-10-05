// Runs once when the Next.js server starts. Invalid env stops the process (scenario 27).
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") await import("./server/startup");
}
