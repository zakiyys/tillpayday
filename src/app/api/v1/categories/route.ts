import { createCategory, listCategories } from "@/server/ledger/categories";
import { actorFrom } from "@/server/ledger/scope";
import { json, route } from "@/server/http";

export const GET = route(async ({ session }) => json({ categories: await listCategories(actorFrom(session)) }));
export const POST = route(async ({ req, session }) => json({ category: await createCategory(actorFrom(session), await req.json()) }, { status: 201 }));
