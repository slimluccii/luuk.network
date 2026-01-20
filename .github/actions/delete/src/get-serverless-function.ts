import { getInput } from "@actions/core";
import { context } from "@actions/github";
import { sanitizeName } from "./utils/sanitizeName";

export const getServerlessFunction = async ({ namespaceId }: { namespaceId: string }) => {
  const secretKey = getInput('scw_secret_key');
  const branchName = context.ref.replace('refs/heads/', '');

  const url = new URL(
    "https://api.scaleway.com/functions/v1beta1/regions/nl-ams/functions",
  );

  url.searchParams.append("namespace_id", namespaceId);
  url.searchParams.append("name", sanitizeName(branchName));

  const response = await fetch(url, {
    method: "GET",
    headers: new Headers({
      "X-Auth-Token": secretKey,
    }),
  });

  const { functions } = await response.json();

  return functions
    ? functions.find(({ name }) => name === sanitizeName(branchName))
    : undefined;
};
