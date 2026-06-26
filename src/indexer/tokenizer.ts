import {
  processDocument,
  processQuery,
  type LanguageProcessorOptions,
  type ProcessedDocument,
} from '../language/languageProcessor.js';

export type { LanguageProcessorOptions, ProcessedDocument };
export { processDocument as tokenize, processQuery as tokenizeQuery };
