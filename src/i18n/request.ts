import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';
import { DEFAULT_LOCALE, isSupportedLocale } from './locales';

export default getRequestConfig(async () => {
    const cookieStore = await cookies();
    const cookieLocale = cookieStore.get('locale')?.value;
    const locale = isSupportedLocale(cookieLocale) ? cookieLocale : DEFAULT_LOCALE;

    return {
        locale,
        // Prevent Turbopack from tracing the entire messages folder at build time
        messages: (await import(/*turbopackIgnore: true*/ `../../messages/${locale}.json`)).default
    };
});
