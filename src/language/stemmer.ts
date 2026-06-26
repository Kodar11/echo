import { stemmer as englishStemmer } from 'stemmer';

export type SupportedStemLanguage = 'eng';

const STEMMERS: Record<SupportedStemLanguage, (term: string) => string> = {
  eng: englishStemmer,
};

/**
 * Stem a term using the best available stemmer for the given language.
 * Returns the original term if no stemmer is available.
 */
export function stemTerm(term: string, language: string | null): string {
  if (!language) return term;
  const stemmer = STEMMERS[language.toLowerCase() as SupportedStemLanguage];
  return stemmer ? stemmer(term) : term;
}

export function supportsStemming(language: string | null): boolean {
  if (!language) return false;
  return Object.prototype.hasOwnProperty.call(
    STEMMERS,
    language.toLowerCase()
  );
}
