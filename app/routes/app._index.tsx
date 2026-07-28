import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { authenticate, PRO_PLAN, COMPANY_PLAN } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";

const isTest = process.env.SHOPIFY_BILLING_TEST_MODE !== "false";

const KULOVA_BACKEND_URL =
  process.env.KULOVA_BACKEND_URL || "https://kulova-backend.vercel.app";

// {api_key}/{handle} per https://shopify.dev/docs/apps/build/online-store/theme-app-extensions/configuration
// — the deprecated {uuid} (extension uid) form does not work here, api_key (client_id) is required.
// handle is the block's Liquid filename: extensions/kulova-widget/blocks/kulova_chat.liquid
const WIDGET_ACTIVATE_ID = `${process.env.SHOPIFY_API_KEY}/kulova_chat`;

type Business = {
  id: string;
  bot_name: string;
  is_active: boolean;
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session, billing } = await authenticate.admin(request);

  const { appSubscriptions } = await billing.check({
    plans: [PRO_PLAN, COMPANY_PLAN],
    isTest,
  });
  const currentPlan = appSubscriptions[0]?.name ?? "Free";

  const shopResponse = await admin.graphql(
    `#graphql
      query ShopInfo {
        shop {
          name
          email
        }
      }`,
  );
  const shopJson = await shopResponse.json();
  const shopName = shopJson.data?.shop?.name as string | undefined;
  const shopEmail = shopJson.data?.shop?.email as string | undefined;

  let business: Business | null = null;
  let syncError = false;

  if (process.env.KULOVA_INTERNAL_KEY) {
    try {
      const syncResponse = await fetch(
        `${KULOVA_BACKEND_URL}/api/shopify-sync`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-kulova-key": process.env.KULOVA_INTERNAL_KEY,
          },
          body: JSON.stringify({
            shopDomain: session.shop,
            shopName,
            email: shopEmail,
          }),
        },
      );
      if (syncResponse.ok) {
        const syncJson = await syncResponse.json();
        business = syncJson.business ?? null;
      } else {
        syncError = true;
      }
    } catch {
      syncError = true;
    }
  } else {
    syncError = true;
  }

  return {
    shop: session.shop,
    business,
    syncError,
    currentPlan,
    activateUrl: `https://${session.shop}/admin/themes/current/editor?context=apps&activateAppId=${WIDGET_ACTIVATE_ID}`,
  };
};

export default function Index() {
  const { shop, business, syncError, currentPlan, activateUrl } =
    useLoaderData<typeof loader>();

  return (
    <s-page heading="Kulova">
      <s-button slot="primary-action" href={activateUrl} target="_blank">
        Activate widget in theme editor
      </s-button>

      <s-section heading={`Welcome, ${shop}`}>
        <s-paragraph>
          Kulova is an AI-powered customer support chat for your store.
          Activate the widget in your theme using the button above, and the
          bot will start answering your customers' questions right away.
        </s-paragraph>

        {syncError && (
          <s-banner tone="warning" heading="Account sync failed">
            <s-paragraph>
              We couldn't reach Kulova's backend just now. You can still
              activate the widget — sync will be retried the next time you
              open this page.
            </s-paragraph>
          </s-banner>
        )}

        {business && (
          <s-paragraph>
            Bot name: {business.bot_name} · Status:{" "}
            <s-badge tone={business.is_active ? "success" : "neutral"}>
              {business.is_active ? "active" : "inactive"}
            </s-badge>
          </s-paragraph>
        )}
      </s-section>

      <s-section slot="aside" heading="Next steps">
        <s-unordered-list>
          <s-list-item>
            Activate the Kulova widget in the theme editor using the button
            above.
          </s-list-item>
          <s-list-item>
            Go through your <s-link href="/app/settings">bot settings</s-link>{" "}
            — pre-filled with your store's information.
          </s-list-item>
          <s-list-item>Test the chat in your store.</s-list-item>
          <s-list-item>
            The bot name, welcome message, position, and color are edited in
            the theme editor's App embeds panel (same button as activation).
          </s-list-item>
        </s-unordered-list>
      </s-section>

      <s-section slot="aside" heading="Plan">
        <s-paragraph>Current plan: {currentPlan}</s-paragraph>
        <s-link href="/app/plans">Manage subscription</s-link>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
