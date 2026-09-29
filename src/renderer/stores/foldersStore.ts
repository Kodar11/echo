import { create } from 'zustand';

interface FoldersState {
  folders: IndexedFolder[];
  /** False until the first load finished (drives skeletons). */
  loaded: boolean;
  loadFolders: () => Promise<void>;
  addFolder: (path: string) => Promise<IndexedFolder>;
  /** Opens the folder picker and adds the choice; null when cancelled. */
  selectFolder: () => Promise<IndexedFolder | null>;
  removeFolder: (id: number) => Promise<void>;
  setEnabled: (id: number, enabled: boolean) => Promise<void>;
}

export const useFoldersStore = create<FoldersState>((set, get) => ({
  folders: [],
  loaded: false,
  loadFolders: async () => {
    const folders = await window.electron.getFolders();
    set({ folders, loaded: true });
  },
  addFolder: async (path) => {
    const folder = await window.electron.addFolder({ path });
    await get().loadFolders();
    return folder;
  },
  selectFolder: async () => {
    const selected = await window.electron.selectFolder();
    if (!selected) return null;
    return get().addFolder(selected);
  },
  removeFolder: async (id) => {
    await window.electron.removeFolder({ id });
    await get().loadFolders();
  },
  setEnabled: async (id, enabled) => {
    await window.electron.setFolderEnabled({ id, enabled });
    await get().loadFolders();
  },
}));
