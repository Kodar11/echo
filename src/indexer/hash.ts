import crypto from 'crypto';
import fs from 'fs';
import { CancelledError } from './cancellation.js';

/** SHA-256 of the file contents, streamed. Aborting destroys the stream. */
export function computeFileHash(filePath: string, signal?: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new CancelledError());
      return;
    }
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    const onAbort = () => {
      stream.destroy();
      reject(new CancelledError());
    };
    signal?.addEventListener('abort', onAbort, { once: true });
    const cleanup = () => signal?.removeEventListener('abort', onAbort);

    stream.on('error', (err) => {
      cleanup();
      reject(err);
    });
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => {
      cleanup();
      resolve(hash.digest('hex'));
    });
  });
}
