import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, payload, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);
  console.log("Customer redact payload:", JSON.stringify(payload));

  // Kulova's chat widget never captures Shopify customer identity (id/email/phone) —
  // conversations are keyed only by an anonymous per-visit session id, so there is no
  // stored data linkable to this specific customer to redact.

  return new Response();
};
