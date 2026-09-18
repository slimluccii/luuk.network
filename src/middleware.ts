import { defineMiddleware } from "astro:middleware";

export const onRequest = defineMiddleware((context, next) => {
  if (context.url.pathname !== "/") return next();

  const locale = context.preferredLocale ?? context.currentLocale;
  return new Response(null, {
    status: 302,
    headers: { location: `/${locale}/`, vary: "accept-language" },
  });
});
