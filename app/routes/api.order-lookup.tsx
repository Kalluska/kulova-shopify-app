import type { ActionFunctionArgs } from "react-router";
import { unauthenticated } from "../shopify.server";

// Sisäinen endpoint jota vain kulova-backend kutsuu (chat.js:n tool use -flow).
// Palauttaa AINA suodatetun minimivastauksen — ei koskaan raakaa Shopify-tilausdataa,
// osoitetta, puhelinta, maksutietoja tai access tokenia. kulova-backend ei koskaan
// näe Shopifyn admin-tokenia, se pysyy tässä appissa offline-sessiona.
const ORDER_QUERY = `#graphql
  query FindOrder($query: String!) {
    orders(first: 1, query: $query) {
      edges {
        node {
          name
          email
          displayFulfillmentStatus
          displayFinancialStatus
          fulfillments(first: 5) {
            trackingInfo {
              number
              url
            }
          }
        }
      }
    }
  }
`;

const NOT_FOUND = { found: false };

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const key = request.headers.get("x-kulova-key");
  if (!process.env.KULOVA_INTERNAL_KEY || key !== process.env.KULOVA_INTERNAL_KEY) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: { shopDomain?: string; orderNumber?: string; email?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid json" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { shopDomain, orderNumber, email } = body;
  const digits = String(orderNumber || "").replace(/[^0-9]/g, "");
  const normalizedEmail = String(email || "").trim().toLowerCase();

  if (!shopDomain || !digits || !normalizedEmail) {
    return new Response(JSON.stringify(NOT_FOUND), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const { admin } = await unauthenticated.admin(shopDomain);
    const response = await admin.graphql(ORDER_QUERY, {
      variables: { query: `name:#${digits}` },
    });
    const json = await response.json();
    const order = json.data?.orders?.edges?.[0]?.node;

    // Omistajuustarkistus: tilauksen sähköpostin täytyy täsmätä annettuun —
    // muuten kuka tahansa voisi arvata tilausnumeroita ja saada tilan.
    if (!order || String(order.email || "").toLowerCase() !== normalizedEmail) {
      return new Response(JSON.stringify(NOT_FOUND), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const tracking = order.fulfillments?.[0]?.trackingInfo?.[0];

    return new Response(
      JSON.stringify({
        found: true,
        orderNumber: order.name,
        fulfillmentStatus: order.displayFulfillmentStatus,
        financialStatus: order.displayFinancialStatus,
        trackingNumber: tracking?.number || undefined,
        trackingUrl: tracking?.url || undefined,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("order-lookup error:", err);
    return new Response(JSON.stringify(NOT_FOUND), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
};
