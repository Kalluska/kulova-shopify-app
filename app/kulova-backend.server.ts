// Server-only helpers for talking to kulova-backend's internal /api/shopify-sync endpoint.
import { PRO_PLAN, COMPANY_PLAN } from "./shopify.server";

export const KULOVA_BACKEND_URL =
  process.env.KULOVA_BACKEND_URL || "https://kulova-backend.vercel.app";

export type KulovaPlan = "free" | "pro" | "company";

// Monthly conversation limits — keep in sync with kulova-backend (chat.js, shopify-sync.js).
export const PLAN_LIMITS: Record<KulovaPlan, number> = {
  free: 100,
  pro: 1000,
  company: 10000,
};

export function planFromSubscriptionName(name?: string | null): KulovaPlan {
  if (name === PRO_PLAN) return "pro";
  if (name === COMPANY_PLAN) return "company";
  return "free";
}

// Writes the shop's current plan to the backend so chat.js enforces the right limit.
// Never throws: a failed sync must not break the admin page or a webhook response.
export async function syncPlan(shopDomain: string, plan: KulovaPlan): Promise<boolean> {
  if (!process.env.KULOVA_INTERNAL_KEY) return false;
  try {
    const r = await fetch(`${KULOVA_BACKEND_URL}/api/shopify-sync`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-kulova-key": process.env.KULOVA_INTERNAL_KEY,
      },
      body: JSON.stringify({ shopDomain, plan }),
    });
    return r.ok;
  } catch {
    return false;
  }
}
