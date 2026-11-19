// ============================================================
// src/constants/translations.ts
// Four-language interface strings, including one right-to-left
// script. Keys are typed from the English catalogue so a missing
// translation is a compile error, not a runtime surprise.
// ============================================================

import type { SupportedLanguage } from '@/types';

export type SupportedLang = SupportedLanguage;

const EN = {
  'nav.air': 'Air now',
  'nav.routine': 'My day',
  'nav.home': 'Home air',
  'nav.swaps': 'Better swaps',
  'nav.impact': 'Impact',
  'nav.community': 'Community',
  'app.tagline': 'Your family’s smog companion',
  'action.refresh': 'Refresh readings',
  'action.generate': 'Build my day',
  'action.join': 'I’m in',
  'air.current': 'Right now',
  'air.forecast': 'Next 24 hours',
  'air.advisory': 'What this means for you',
  'air.stagnation': 'Stagnation risk',
  'routine.summary': 'Today’s plan',
  'routine.bestWindow': 'Best outdoor window',
  'home.calculator': 'Room calculator',
  'home.hacks': 'Indoor air hacks',
  'swaps.title': 'Sustainable alternatives',
  'impact.title': 'Your direct impact',
  'community.title': 'Neighbourhood pledges',
  'common.loading': 'Loading…',
  'common.error': 'Something went wrong',
  'common.offline': 'Sample readings shown — live data unavailable',
} as const;

type Catalogue = Record<keyof typeof EN, string>;
/** Every translatable string, derived from the English catalogue. */
export type TranslationKey = keyof typeof EN;

const HI: Catalogue = {
  'nav.air': 'अभी हवा',
  'nav.routine': 'मेरा दिन',
  'nav.home': 'घर की हवा',
  'nav.swaps': 'बेहतर विकल्प',
  'nav.impact': 'असर',
  'nav.community': 'समुदाय',
  'app.tagline': 'आपके परिवार का स्मोग साथी',
  'action.refresh': 'आँकड़े ताज़ा करें',
  'action.generate': 'मेरा दिन बनाएँ',
  'action.join': 'मैं शामिल हूँ',
  'air.current': 'अभी',
  'air.forecast': 'अगले 24 घंटे',
  'air.advisory': 'आपके लिए इसका मतलब',
  'air.stagnation': 'वायु-रुकावट का ख़तरा',
  'routine.summary': 'आज की योजना',
  'routine.bestWindow': 'बाहर सबसे अच्छा समय',
  'home.calculator': 'कमरे का हिसाब',
  'home.hacks': 'घरेलू हवा उपाय',
  'swaps.title': 'हरित विकल्प',
  'impact.title': 'आपका सीधा असर',
  'community.title': 'मोहल्ले के संकल्प',
  'common.loading': 'लोड हो रहा है…',
  'common.error': 'कुछ गड़बड़ हो गई',
  'common.offline': 'नमूना आँकड़े दिख रहे हैं — लाइव डेटा उपलब्ध नहीं',
};

const AR: Catalogue = {
  'nav.air': 'الهواء الآن',
  'nav.routine': 'يومي',
  'nav.home': 'هواء المنزل',
  'nav.swaps': 'بدائل أفضل',
  'nav.impact': 'الأثر',
  'nav.community': 'المجتمع',
  'app.tagline': 'رفيق عائلتك في الضباب الدخاني',
  'action.refresh': 'تحديث القراءات',
  'action.generate': 'أنشئ يومي',
  'action.join': 'أنا مشارك',
  'air.current': 'الآن',
  'air.forecast': 'الـ 24 ساعة القادمة',
  'air.advisory': 'ماذا يعني هذا لك',
  'air.stagnation': 'خطر الجمود الهوائي',
  'routine.summary': 'خطة اليوم',
  'routine.bestWindow': 'أفضل وقت للخروج',
  'home.calculator': 'حساب الغرفة',
  'home.hacks': 'حيل تحسين الهواء',
  'swaps.title': 'بدائل مستدامة',
  'impact.title': 'أثرك المباشر',
  'community.title': 'تعهدات الحي',
  'common.loading': 'جارٍ التحميل…',
  'common.error': 'حدث خطأ ما',
  'common.offline': 'تُعرض قراءات نموذجية — البيانات المباشرة غير متاحة',
};

const ES: Catalogue = {
  'nav.air': 'Aire ahora',
  'nav.routine': 'Mi día',
  'nav.home': 'Aire del hogar',
  'nav.swaps': 'Mejores alternativas',
  'nav.impact': 'Impacto',
  'nav.community': 'Comunidad',
  'app.tagline': 'Tu compañero de smog en familia',
  'action.refresh': 'Actualizar lecturas',
  'action.generate': 'Crear mi día',
  'action.join': 'Me uno',
  'air.current': 'Ahora mismo',
  'air.forecast': 'Próximas 24 horas',
  'air.advisory': 'Qué significa esto para ti',
  'air.stagnation': 'Riesgo de estancamiento',
  'routine.summary': 'Plan de hoy',
  'routine.bestWindow': 'Mejor ventana para salir',
  'home.calculator': 'Calculadora de habitación',
  'home.hacks': 'Trucos de aire interior',
  'swaps.title': 'Alternativas sostenibles',
  'impact.title': 'Tu impacto directo',
  'community.title': 'Compromisos del barrio',
  'common.loading': 'Cargando…',
  'common.error': 'Algo salió mal',
  'common.offline': 'Lecturas de muestra — datos en vivo no disponibles',
};

export const CATALOGUES: Readonly<Record<SupportedLang, Catalogue>> = {
  en: EN,
  hi: HI,
  ar: AR,
  es: ES,
};

/** Every supported language, with the endonym shown in the picker. */
export const LANGUAGES: readonly { readonly id: SupportedLang; readonly label: string }[] = [
  { id: 'en', label: 'English' },
  { id: 'hi', label: 'हिन्दी' },
  { id: 'ar', label: 'العربية' },
  { id: 'es', label: 'Español' },
];

/** Right-to-left scripts need the document direction flipped. */
export function isRtl(lang: SupportedLang): boolean {
  return lang === 'ar';
}

/** Typed lookup that falls back to English for an unknown key. */
export function translate(lang: SupportedLang, key: TranslationKey): string {
  return CATALOGUES[lang][key] ?? EN[key];
}
