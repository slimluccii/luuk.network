import * as BunnySDK from "@bunny.net/edgescript-sdk";
BunnySDK.net.http.servePullZone().onOriginRequest(async () => {
  const results: Record<string, string> = {};
  try {
    await import("data:text/javascript;base64," + btoa("export default 1;"));
    results.importData = "ok";
  } catch (e) { results.importData = String(e); }
  try {
    results.newFunction = String(new Function("return 40 + 2")());
  } catch (e) { results.newFunction = String(e); }
  try {
    // deno-lint-ignore no-eval
    results.eval = String((0, eval)("40 + 2"));
  } catch (e) { results.eval = String(e); }
  try {
    const mod = new WebAssembly.Module(new Uint8Array([0,97,115,109,1,0,0,0]));
    results.wasm = mod ? "ok" : "?";
  } catch (e) { results.wasm = String(e); }
  return new Response(JSON.stringify(results, null, 2), {
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
});
