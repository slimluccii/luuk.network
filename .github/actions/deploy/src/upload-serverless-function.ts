import { getInput } from "@actions/core";
import { readFileSync, statSync } from "fs";
import { join } from "path";

export const uploadServerlessFunction = async ({ functionId }: { functionId: string }) => {
  const secretKey = getInput("scw_secret_key");

  const zipFilePath = join(process.cwd(), "function.zip");
  const zipFileBuffer = readFileSync(zipFilePath);
  const fileSize = statSync(zipFilePath).size;

  const url = new URL(
    `https://api.scaleway.com/functions/v1beta1/regions/nl-ams/functions/${functionId}/upload-url`,
  );

  url.searchParams.append("content_length", String(fileSize));

  const response = await fetch(url, {
    method: "GET",
    headers: new Headers({
      "X-Auth-Token": secretKey,
    }),
  });

  const { url: uploadUrl, headers: uploadHeaders } = await response.json();

  await fetch(uploadUrl, {
    method: "PUT",
    headers: uploadHeaders,
    body: zipFileBuffer,
  });
};
