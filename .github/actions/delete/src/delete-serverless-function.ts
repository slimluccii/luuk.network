import { getInput } from "@actions/core";

export const deleteServerlessFunction = async ({ function_id }: { function_id: string }) => {
  const secretKey = getInput("scw_secret_key");

  const url = new URL(
    `https://api.scaleway.com/functions/v1beta1/regions/nl-ams/functions/${function_id}`,
  );

  const response = await fetch(url, {
    method: "DELETE",
    headers: new Headers({
      "X-Auth-Token": secretKey,
      "Content-Type": "application/json",
    })
  });

  return await response.json();
};
