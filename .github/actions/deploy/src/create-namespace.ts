import { getInput } from "@actions/core";
import { context } from "@actions/github";
import { sanitizeName } from "./utils/sanitizeName";

export const createNamespace = async () => {
  const secretKey = getInput("scw_secret_key");
  const projectId = getInput("scw_project_id");

  const url = new URL(
    "https://api.scaleway.com/functions/v1beta1/regions/nl-ams/namespaces",
  );

  const response = await fetch(url, {
    method: "POST",
    headers: new Headers({
      "X-Auth-Token": secretKey,
      "Content-Type": "application/json",
    }),
    body: JSON.stringify({
      name: sanitizeName(context.repo.repo),
      project_id: projectId,
    }),
  });

  return await response.json();
};
