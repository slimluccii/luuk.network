// Scenario 1: measure Bunny's floor with a script that does nothing.
import * as BunnySDK from "@bunny.net/edgescript-sdk";
BunnySDK.net.http.servePullZone().onOriginRequest(async () => new Response("ok"));
