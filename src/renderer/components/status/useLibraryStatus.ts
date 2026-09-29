import { useMemo } from 'react';
import { describeLibraryStatus, type LibraryStatus } from '../../lib/status.js';
import { useFailuresStore } from '../../stores/failuresStore.js';
import { useFoldersStore } from '../../stores/foldersStore.js';
import { useIndexStore } from '../../stores/indexStore.js';

export function useLibraryStatus(): LibraryStatus {
  const progress = useIndexStore((s) => s.progress);
  const status = useIndexStore((s) => s.status);
  const folderCount = useFoldersStore((s) => s.folders.length);
  const attention = useFailuresStore((s) => s.failures.reduce((n, f) => (f.ignored ? n : n + 1), 0));
  return useMemo(
    () => describeLibraryStatus({ progress, status, folderCount, attention }),
    [progress, status, folderCount, attention]
  );
}
