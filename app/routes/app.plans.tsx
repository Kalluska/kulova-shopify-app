import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { useLoaderData, useNavigation, useSubmit } from "react-router";
import { authenticate, PRO_PLAN, COMPANY_PLAN } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { planFromSubscriptionName, syncPlan } from "../kulova-backend.server";

// Shopify blocks real charges on dev/trial stores regardless of this flag,
// but it must be flipped to "false" (via env var) before charging live merchants.
const isTest = process.env.SHOPIFY_BILLING_TEST_MODE !== "false";

// Plan ids duplicated as string literals (not imported from shopify.server) because this
// array is also used by the client-rendered component below, and shopify.server is a
// server-only module — React Router can't code-split it out of a client-referenced import.
const PLANS = [
  {
    id: "free",
    name: "Free",
    price: "0",
    description: "100 conversations/month",
  },
  {
    id: "Pro",
    name: "Pro",
    price: "29",
    description: "1,000 conversations/month",
  },
  {
    id: "Company",
    name: "Company",
    price: "149",
    description: "10,000 conversations/month",
  },
] as const;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { billing, session } = await authenticate.admin(request);

  const { appSubscriptions } = await billing.check({
    plans: [PRO_PLAN, COMPANY_PLAN],
    isTest,
  });

  const currentPlan = appSubscriptions[0]?.name ?? "free";
  const currentSubscriptionId = appSubscriptions[0]?.id;

  // This page is the billing returnUrl, so it's the first thing a merchant sees after
  // approving a charge: sync the plan immediately instead of waiting for the webhook.
  await syncPlan(session.shop, planFromSubscriptionName(appSubscriptions[0]?.name));

  return { currentPlan, currentSubscriptionId };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { billing, session } = await authenticate.admin(request);
  const formData = await request.formData();
  const plan = formData.get("plan");

  if (plan === "free") {
    const { appSubscriptions } = await billing.check({
      plans: [PRO_PLAN, COMPANY_PLAN],
      isTest,
    });
    const active = appSubscriptions[0];
    if (active) {
      await billing.cancel({
        subscriptionId: active.id,
        isTest,
        prorate: true,
      });
    }
    return { ok: true };
  }

  if (plan !== PRO_PLAN && plan !== COMPANY_PLAN) {
    throw new Response("Invalid plan", { status: 400 });
  }

  return billing.request({
    plan,
    isTest,
    // Must be the embedded admin URL. A bare `${SHOPIFY_APP_URL}/app/plans` loads the app
    // top-level, outside the admin iframe, where there is no session -> /auth/login page
    // (seen in the screencast run 2026-10-04 after approving a charge).
    returnUrl: `https://admin.shopify.com/store/${session.shop.replace(".myshopify.com", "")}/apps/${process.env.SHOPIFY_APP_HANDLE || "kulova-app"}/app/plans`,
  });
};

export default function Plans() {
  const { currentPlan } = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const selectPlan = (planId: string) => {
    submit({ plan: planId }, { method: "POST" });
  };

  return (
    <s-page heading="Plans">
      <s-section heading="Choose a plan">
        <s-paragraph>
          Flat pricing — no per-resolution fees. Switch or cancel anytime.
        </s-paragraph>
        <s-stack direction="inline" gap="base">
          {PLANS.map((plan) => {
            const isCurrent = plan.id === currentPlan;
            return (
              <s-box
                key={plan.id}
                padding="base"
                borderWidth="base"
                borderRadius="base"
                background={isCurrent ? "subdued" : undefined}
              >
                <s-stack direction="block" gap="small">
                  <s-heading>{plan.name}</s-heading>
                  <s-text>${plan.price}/mo</s-text>
                  <s-paragraph>{plan.description}</s-paragraph>
                  {isCurrent ? (
                    <s-badge tone="success">Current plan</s-badge>
                  ) : (
                    <s-button
                      onClick={() => selectPlan(plan.id)}
                      {...(isSubmitting ? { loading: true } : {})}
                    >
                      {plan.id === "free" ? "Switch to Free" : "Select"}
                    </s-button>
                  )}
                </s-stack>
              </s-box>
            );
          })}
        </s-stack>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
