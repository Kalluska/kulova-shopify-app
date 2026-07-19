/// <reference types="vite/client" />
/// <reference types="@react-router/node" />

// The `export {}` makes this file a module so the `declare module` below augments
// react's existing types instead of replacing them wholesale.
export {};

// s-app-nav is missing from the installed @shopify/polaris-types version
// (all other s-* elements used here are typed by that package).
declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "s-app-nav": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement>,
        HTMLElement
      >;
    }
  }
}
