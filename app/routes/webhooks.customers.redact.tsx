import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, payload, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);
  console.log("Customer redact payload:", JSON.stringify(payload));

  // Tilausseurannan myötä asiakkaan email/tilausnumero voi päätyä messages.content:iin
  // osana tavallista keskustelutekstiä (asiakas kirjoittaa ne botille itse). Etsitään
  // kaikki keskustelut jotka sisältävät tämän asiakkaan yhteystiedon ja poistetaan ne.
  const email = (payload as { customer?: { email?: string; phone?: string } })?.customer?.email;
  const phone = (payload as { customer?: { email?: string; phone?: string } })?.customer?.phone;

  if (!email && !phone) {
    console.log("customers/redact: ei email/phone payloadissa, ei mitään etsittävää.");
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

  for (const conversationId of conversationIds) {
    await db.$executeRaw`DELETE FROM public.messages WHERE conversation_id = ${conversationId}::uuid`;
    await db.$executeRaw`DELETE FROM public.conversations WHERE id = ${conversationId}::uuid`;
  }

  console.log(`customers/redact: poistettu ${conversationIds.size} keskustelua (${shop}).`);

  return new Response();
};
