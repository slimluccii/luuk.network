import { getInput } from "@actions/core";
import { context } from "@actions/github";

export const getNamespace = async () => {
  const secretKey = getInput("scw_secret_key");

  const url = new URL(
    "https://api.scaleway.com/functions/v1beta1/regions/nl-ams/namespaces",
  );

  const response = await fetch(url, {
    method: "GET",
    headers: new Headers({
      "X-Auth-Token": secretKey,
    }),
  });

  console.log(response)

  const { namespaces } = await response.json();

  return namespaces
    ? namespaces.find(({ name }) => name === context.repo.repo)
    : undefined;
};
