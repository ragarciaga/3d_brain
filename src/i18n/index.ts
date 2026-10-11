import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import es from './es.json';
import type { Idioma } from '../data/tipos';

export const IDIOMAS: Idioma[] = ['es', 'en'];

export function idiomaDelNavegador(): Idioma {
  const n = (typeof navigator !== 'undefined' ? navigator.language : 'es').slice(0, 2).toLowerCase();
  return n === 'en' ? 'en' : 'es';
}

void i18n.use(initReactI18next).init({
  resources: { es: { translation: es }, en: { translation: en } },
  lng: 'es',
  fallbackLng: false,
  interpolation: { escapeValue: false },
  returnNull: false,
});

export default i18n;
