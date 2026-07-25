import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, payload, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);
  console.log("Shop redact payload:", JSON.stringify(payload));

  await db.session.deleteMany({ where: { shop } });

  // kulova-backend owns businesses/conversations/messages in the shared Supabase
  // Postgres "public" schema (not modeled in this app's Prisma schema, which only
  // manages Session in the isolated "shopify_app" schema) — delete them directly,
  // scoped strictly to this shop's business row(s).
  const businesses = await db.$queryRaw<
    { id: string }[]
  >`SELECT id FROM public.businesses WHERE shopify_domain = ${shop}`;

  for (const { id } of businesses) {
    await db.$executeRaw`DELETE FROM public.messages WHERE business_id = ${id}`;
    await db.$executeRaw`DELETE FROM public.conversations WHERE business_id = ${id}`;
    await db.$executeRaw`DELETE FROM public.businesses WHERE id = ${id}`;
  }

  return new Response();
};
