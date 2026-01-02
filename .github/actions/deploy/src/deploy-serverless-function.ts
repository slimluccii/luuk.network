import { getInput } from "@actions/core";

export const deployServerlessFunction = async ({
  functionId,
}: {
  functionId: string;
}) => {
  const secretKey = getInput("scw_secret_key");

  const url = new URL(
    `https://api.scaleway.com/functions/v1beta1/regions/nl-ams/functions/${functionId}/deploy`,
  );

  const response = await fetch(url, {
    method: "POST",
    headers: new Headers({
      "X-Auth-Token": secretKey,
      "Content-Type": "application/json"
    }),
  });

  await response.json();
};
