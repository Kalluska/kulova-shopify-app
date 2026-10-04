import type { ActionFunctionArgs } from "react-router";
import { unauthenticated } from "../shopify.server";

// Internal endpoint called only by kulova-backend (chat.js search_products tool).
// Returns public storefront info only: title, price range, availability, URL.
// The Shopify access token never leaves this app.
const PRODUCT_QUERY = `#graphql
  query SearchProducts($query: String!) {
    products(first: 6, query: $query, sortKey: RELEVANCE) {
      edges {
        node {
          title
          handle
          productType
          onlineStoreUrl
          totalInventory
          tracksInventory
          priceRangeV2 {
            minVariantPrice { amount currencyCode }
            maxVariantPrice { amount currencyCode }
          }
        }
      }
    }
  }
`;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const key = request.headers.get("x-kulova-key");
  if (!process.env.KULOVA_INTERNAL_KEY || key !== process.env.KULOVA_INTERNAL_KEY) {
    return json({ error: "unauthorized" }, 401);
  }

  let body: { shopDomain?: string; query?: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid json" }, 400);
  }

  const shopDomain = String(body.shopDomain || "");
  if (!shopDomain.endsWith(".myshopify.com")) return json({ products: [] });

  // Strip Shopify search syntax characters so customer text can't alter the query.
  const terms = String(body.query || "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 5);
  // Default-field search (title, vendor, product type, tags) with prefix wildcard; a naive
  // singular form so "snowboards" still matches "snowboard".
  const search = [
    "status:active",
    ...terms.map((t) => `${t.length > 4 && /s$/i.test(t) ? t.slice(0, -1) : t}*`),
  ].join(" ");

  try {
    const { admin } = await unauthenticated.admin(shopDomain);
    const response = await admin.graphql(PRODUCT_QUERY, { variables: { query: search } });
    const data = await response.json();
    const products = (data.data?.products?.edges || []).map(({ node }: any) => {
      const min = node.priceRangeV2?.minVariantPrice;
      const max = node.priceRangeV2?.maxVariantPrice;
      const price =
        min && max && min.amount !== max.amount
          ? `${min.amount}–${max.amount} ${min.currencyCode}`
          : min
            ? `${min.amount} ${min.currencyCode}`
            : undefined;
      return {
        title: node.title,
        type: node.productType || undefined,
        price,
        inStock: node.tracksInventory ? (node.totalInventory ?? 0) > 0 : true,
        url: node.onlineStoreUrl || `https://${shopDomain}/products/${node.handle}`,
      };
    });
    return json({ products });
  } catch (err) {
    console.error("product-search error:", err);
    return json({ products: [] });
  }
};
