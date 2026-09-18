import { i18n } from "astro:config/client";
import { defineMiddleware } from "astro:middleware";
import { LOCALE_COOKIE } from "~/i18n/locale-cookie";

export const onRequest = defineMiddleware((context, next) => {
  if (context.url.pathname !== "/") return next();

  const chosen = context.cookies.get(LOCALE_COOKIE)?.value;
  const remembered = i18n?.locales.some((locale) => locale === chosen)
    ? chosen
    : undefined;
  const locale = remembered ?? context.preferredLocale ?? context.currentLocale;

  return new Response(null, {
    status: 302,
    headers: { location: `/${locale}/`, vary: "accept-language, cookie" },
  });
});
