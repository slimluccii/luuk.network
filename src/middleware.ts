import { defineMiddleware } from 'astro:middleware';

export const onRequest = defineMiddleware((context, next) => {
  const {
    cookies,
    currentLocale,
    originPathname,
    preferredLocale,
    redirect
  } = context;

  const locale = cookies.get('locale')?.value;

  if (originPathname === '/') {
    const target = locale ?? preferredLocale;
    if (target) {
      return redirect(`/${target}/`, 302);
    }
  } else if (currentLocale) {
    cookies.set('locale', currentLocale, { path: '/' });
  }

  return next();
});
