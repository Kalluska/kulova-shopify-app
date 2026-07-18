import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, payload, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);
  console.log("Shop redact payload:", JSON.stringify(payload));

  await db.session.deleteMany({ where: { shop } });
  // TODO: also delete conversation/business rows tied to this shop
  // once the storage schema is confirmed.

  return new Response();
};
