import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { Form, useActionData, useLoaderData, useNavigation } from "react-router";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";

const KULOVA_BACKEND_URL =
  process.env.KULOVA_BACKEND_URL || "https://kulova-backend.vercel.app";

type BackendSettings = {
  services?: string | null;
  hours?: string | null;
  bot_instructions?: string | null;
  support_email?: string | null;
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);

  let current: BackendSettings = {};
  if (process.env.KULOVA_INTERNAL_KEY) {
    try {
      const r = await fetch(
        `${KULOVA_BACKEND_URL}/api/shopify-sync?shopDomain=${encodeURIComponent(session.shop)}`,
        { headers: { "x-kulova-key": process.env.KULOVA_INTERNAL_KEY } },
      );
      if (r.ok) {
        const json = await r.json();
        current = json.settings ?? {};
      }
    } catch {
      // backend unreachable — fall through to Shopify-only prefill below
    }
  }

  const hasAnyContent = Boolean(
    current.services || current.hours || current.bot_instructions || current.support_email,
  );

  let shopDescription = "";
  let shopContactEmail = "";
  let shopCurrency = "";
  if (!hasAnyContent) {
    const shopResponse = await admin.graphql(
      `#graphql
        query ShopPrefill {
          shop {
            description
            contactEmail
            currencyCode
          }
        }`,
    );
    const shopJson = await shopResponse.json();
    shopDescription = shopJson.data?.shop?.description || "";
    shopContactEmail = shopJson.data?.shop?.contactEmail || "";
    shopCurrency = shopJson.data?.shop?.currencyCode || "";
  }

  return {
    services: current.services || shopDescription,
    hours: current.hours || "",
    botInstructions: current.bot_instructions || "",
    supportEmail: current.support_email || shopContactEmail,
    currency: shopCurrency,
    prefilled: !hasAnyContent,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();

  if (!process.env.KULOVA_INTERNAL_KEY) {
    return { ok: false, error: "Palvelinasetus puuttuu (KULOVA_INTERNAL_KEY)." };
  }

  const payload = {
    shopDomain: session.shop,
    services: String(formData.get("services") || ""),
    hours: String(formData.get("hours") || ""),
    bot_instructions: String(formData.get("botInstructions") || ""),
    support_email: String(formData.get("supportEmail") || ""),
  };

  const r = await fetch(`${KULOVA_BACKEND_URL}/api/shopify-sync`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "x-kulova-key": process.env.KULOVA_INTERNAL_KEY,
    },
    body: JSON.stringify(payload),
  });

  if (!r.ok) {
    return { ok: false, error: "Tallennus epäonnistui, yritä uudelleen." };
  }

  return { ok: true, error: null };
};

export default function Settings() {
  const { services, hours, botInstructions, supportEmail, currency, prefilled } =
    useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <s-page heading="Botin asetukset">
      <s-section heading="Yrityksen tiedot">
        {prefilled && (
          <s-banner tone="info" heading="Esitäytetty kauppasi Shopify-tiedoilla">
            <s-paragraph>
              Tarkista ja muokkaa vapaasti ennen tallennusta — nämä tiedot
              auttavat bottia vastaamaan asiakkaillesi oikein heti alusta
              alkaen.
            </s-paragraph>
          </s-banner>
        )}
        {actionData?.ok && (
          <s-banner tone="success" heading="Tallennettu">
            <s-paragraph>Botin asetukset päivitetty.</s-paragraph>
          </s-banner>
        )}
        {actionData?.ok === false && (
          <s-banner tone="critical" heading="Virhe">
            <s-paragraph>{actionData.error}</s-paragraph>
          </s-banner>
        )}

        <Form method="post">
          <s-stack direction="block" gap="base">
            <s-text-area
              name="services"
              label="Kuvaus / palvelut"
              details="Mitä kauppa myy tai tarjoaa. Botti käyttää tätä vastatakseen kysymyksiin."
              defaultValue={services}
              rows={4}
            />
            <s-text-field
              name="hours"
              label="Aukioloajat"
              placeholder="esim. Ma-Pe 9-17"
              defaultValue={hours}
            />
            <s-text-area
              name="botInstructions"
              label="Botin lisäohjeet"
              details="Valinnainen. Nämä ohittavat yllä olevat, jos ristiriitaa."
              defaultValue={botInstructions}
              rows={3}
            />
            <s-email-field
              name="supportEmail"
              label="Tukisähköposti"
              details="Tähän botti ohjaa asiakkaan, jos se ei osaa vastata kysymykseen."
              defaultValue={supportEmail}
            />
            {currency && (
              <s-paragraph>Kaupan valuutta: {currency}</s-paragraph>
            )}
            <s-button
              type="submit"
              variant="primary"
              {...(isSubmitting ? { loading: true } : {})}
            >
              Tallenna
            </s-button>
          </s-stack>
        </Form>
      </s-section>

      <s-section slot="aside" heading="Muualla muokattavat">
        <s-paragraph>
          Botin nimi, tervehdysviesti, väri ja widgetin sijainti muokataan
          teemaeditorin App embeds -paneelista.
        </s-paragraph>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
