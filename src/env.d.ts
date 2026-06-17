/// <reference types="astro/client" />

declare module "*.graphql" {
  import type { TypedDocumentNode } from "@datocms/cda-client";
  const node: TypedDocumentNode;
  export default node;
}
