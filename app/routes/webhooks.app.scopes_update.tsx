import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
    const { payload, session, topic, shop } = await authenticate.webhook(request);
    console.log(`Received ${topic} webhook for ${shop}`);

    const current = payload.current as string[];
    if (session) {
        // updateMany (not update): the session row can already be gone by the time this
        // runs — deleted by shop/redact, replaced by an offline-token refresh, or this is
        // a Shopify retry of an already-processed delivery. update() throws (P2025) when
        // no row matches; updateMany() just updates zero rows. Same race uninstalled.tsx
        // already guards against with deleteMany — this webhook was missing that guard,
        // which is why it failed ~95% of deliveries with a 500.
        await db.session.updateMany({
            where: {
                id: session.id
            },
            data: {
                scope: current.toString(),
            },
        });
    }
    return new Response();
};
