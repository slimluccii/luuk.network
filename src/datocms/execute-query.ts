import {
  executeQuery as libExecuteQuery,
  type TypedDocumentNode,
} from "@datocms/cda-client";
import { DATOCMS_CDA_TOKEN } from "astro:env/server";

export async function executeQuery<Result, Variables>(
  query: TypedDocumentNode<Result, Variables>,
  variables?: Variables
) {
  return await libExecuteQuery<Result, Variables>(query, {
    token: DATOCMS_CDA_TOKEN,
    variables,
  });
}
