import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, payload, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);
  console.log("Customer data request payload:", JSON.stringify(payload));

  // Sama osumalogiikka kuin customers/redact:ssa — tilausseurannan myötä asiakkaan
  // email/tilausnumero voi olla messages.content:issa tavallisena keskustelutekstinä.
  const email = (payload as { customer?: { email?: string; phone?: string } })?.customer?.email;
  const phone = (payload as { customer?: { email?: string; phone?: string } })?.customer?.phone;

  if (!email && !phone) {
    console.log("customers/data_request: ei email/phone payloadissa, ei mitään etsittävää.");
    return new Response();
  }

  const businesses = await db.$queryRaw<{ id: string }[]>`
    SELECT id FROM public.businesses WHERE shopify_domain = ${shop}
  `;

  const conversationIds = new Set<string>();
  for (const { id: businessId } of businesses) {
    if (email) {
      const rows = await db.$queryRaw<{ conversation_id: string | null }[]>`
        SELECT DISTINCT conversation_id FROM public.messages
        WHERE business_id = ${businessId} AND content ILIKE ${"%" + email + "%"}
      `;
      rows.forEach((r) => r.conversation_id && conversationIds.add(r.conversation_id));
    }
    if (phone) {
      const rows = await db.$queryRaw<{ conversation_id: string | null }[]>`
        SELECT DISTINCT conversation_id FROM public.messages
        WHERE business_id = ${businessId} AND content ILIKE ${"%" + phone + "%"}
      `;
      rows.forEach((r) => r.conversation_id && conversationIds.add(r.conversation_id));
    }
  }

  if (conversationIds.size === 0) {
    console.log(`customers/data_request: ei osuneita keskusteluja (${shop}).`);
    return new Response();
  }

  const messages = await db.$queryRaw<
    { conversation_id: string; role: string; content: string; created_at: Date }[]
  >`
    SELECT conversation_id, role, content, created_at FROM public.messages
    WHERE conversation_id = ANY(${Array.from(conversationIds)}::uuid[])
    ORDER BY conversation_id, created_at ASC
  `;

  // Shopify ei vaadi automaattista asiakkaalle-toimitusta tästä webhookista —
  // kauppias vastaa pyyntöön itse annetussa ikkunassa. Lokitetaan osunut data
  // Vercel-lokeihin, joista kauppias/ylläpitäjä voi noutaa sen manuaalisesti.
  console.log(
    `customers/data_request: löytyi ${conversationIds.size} osunutta keskustelua (${shop}):`,
    JSON.stringify(messages),
  );

  return new Response();
};
