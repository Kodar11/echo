import { Posting } from '../database/postings.js';

const K1 = 1.2;
const B = 0.75;

export interface Bm25Context {
  totalDocs: number;
  avgDocLength: number;
}

export function computeIdf(df: number, totalDocs: number): number {
  return Math.log(1 + (totalDocs - df + 0.5) / (df + 0.5));
}

export function computeBm25Score(
  posting: Posting,
  docLength: number,
  df: number,
  context: Bm25Context
): number {
  const idf = computeIdf(df, context.totalDocs);
  const denominator =
    posting.termFrequency +
    K1 * (1 - B + (B * docLength) / context.avgDocLength);
  return idf * ((posting.termFrequency * (K1 + 1)) / denominator);
}
