import { useFoldersStore } from '../stores/foldersStore.js';
import { useIndexStore } from '../stores/indexStore.js';
import { humanizeError, toast } from '../stores/toastStore.js';
import { getBasename } from './path.js';

/** Folder picker → add to library, with feedback. Indexing starts automatically. */
export async function addFolderWithFeedback(): Promise<void> {
  try {
    const folder = await useFoldersStore.getState().selectFolder();
    if (folder) {
      toast({ tone: 'success', title: 'Folder added', description: `Echo is indexing ${getBasename(folder.path)}.` });
    }
  } catch (err) {
    toast({ tone: 'error', title: 'Couldn’t add that folder', description: humanizeError(err, 'Please choose another folder.') });
  }
}

/** Cancels the running indexing session; resolves once it has stopped. */
export async function cancelIndexingWithFeedback(): Promise<void> {
  try {
    await useIndexStore.getState().stopIndexing();
    toast({ tone: 'neutral', title: 'Indexing cancelled', description: 'Files indexed so far are searchable.' });
  } catch (err) {
    toast({ tone: 'error', title: 'Couldn’t cancel indexing', description: humanizeError(err, 'Please try again.') });
  }
}
