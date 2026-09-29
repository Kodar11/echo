import { stemmer as englishStemmer } from 'stemmer';

export type SupportedStemLanguage = 'eng';

const STEMMERS: Record<SupportedStemLanguage, (term: string) => string> = {
  eng: englishStemmer,
};

/** Languages (ISO 639-3) for which a stemmer is available. */
export const STEMMING_LANGUAGES = Object.keys(STEMMERS) as SupportedStemLanguage[];

/**
 * Stem a term with the stemmer for `language`. Returns the term unchanged when
 * the language is unknown or has no stemmer — English rules are never applied
 * to text that was not detected as English.
 */
export function stemTerm(term: string, language: string | null): string {
  if (!language) return term;
  const stemmer = STEMMERS[language.toLowerCase() as SupportedStemLanguage];
  return stemmer ? stemmer(term) : term;
}

export function supportsStemming(language: string | null): boolean {
  if (!language) return false;
  return Object.prototype.hasOwnProperty.call(STEMMERS, language.toLowerCase());
}
