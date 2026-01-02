import { getInput } from "@actions/core";
import { context } from "@actions/github";

export const getServerlessFunction = async ({ namespacId }: { namespacId: string }) => {
  const secretKey = getInput('scw_secret_key');
  const branchName = context.ref.replace('refs/heads/', '');

  const url = new URL(
    "https://api.scaleway.com/functions/v1beta1/regions/nl-ams/functions",
  );

  url.searchParams.append("namespace_id", namespacId);
  url.searchParams.append("name", branchName);

  const response = await fetch(url, {
    method: "GET",
    headers: new Headers({
      "X-Auth-Token": secretKey,
    }),
  });

  const { functions } = await response.json();

  return functions
    ? functions.find(({ name }) => name === branchName)
    : undefined;
};
