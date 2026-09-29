import {
  processDocument,
  processQuery,
  tokenizeText,
  tokenizeWithOffsets,
  type LanguageProcessorOptions,
  type ProcessedDocument,
  type TokenWithOffset,
} from '../language/languageProcessor.js';

export type { LanguageProcessorOptions, ProcessedDocument, TokenWithOffset };
export {
  processDocument as tokenize,
  processQuery as tokenizeQuery,
  tokenizeText,
  tokenizeWithOffsets,
};
