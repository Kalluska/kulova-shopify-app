import type { ActionFunctionArgs } from "react-router";
import { authenticate, unauthenticated } from "../shopify.server";
import { planFromSubscriptionName, syncPlan } from "../kulova-backend.server";

// app_subscriptions/update fires on activate, cancel, decline, expire, freeze, etc.
// Payload order isn't guaranteed (e.g. Pro→Company upgrade can deliver "Pro CANCELLED"
// after "Company ACTIVE"), so we never trust the payload status alone: we re-read the
// shop's actual active subscriptions and sync that as the source of truth.
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload } = await authenticate.webhook(request);
  console.log(`Received ${topic} webhook for ${shop}`, payload?.app_subscription?.status);

  try {
    const { admin } = await unauthenticated.admin(shop);
    const r = await admin.graphql(`#graphql
      query ActiveSubs {
        currentAppInstallation {
          activeSubscriptions { name status }
        }
      }`);
    const data = await r.json();
    const active = (data.data?.currentAppInstallation?.activeSubscriptions || []).find(
      (s: { status: string }) => s.status === "ACTIVE",
    );
    await syncPlan(shop, planFromSubscriptionName(active?.name));
  } catch (err) {
    // No offline session (e.g. already uninstalled) — nothing to sync; shop/redact cleans up.
    console.error("subscriptions_update sync failed:", err);
  }

  return new Response();
};
