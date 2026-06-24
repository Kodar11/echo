import { create } from 'zustand';

interface FoldersState {
  folders: IndexedFolder[];
  isLoading: boolean;
  loadFolders: () => Promise<void>;
  addFolder: (path: string) => Promise<void>;
  removeFolder: (id: number) => Promise<void>;
  setEnabled: (id: number, enabled: boolean) => Promise<void>;
}

export const useFoldersStore = create<FoldersState>((set, get) => ({
  folders: [],
  isLoading: false,
  loadFolders: async () => {
    const folders = await window.electron.getFolders();
    set({ folders });
  },
  addFolder: async (path) => {
    await window.electron.addFolder({ path });
    await get().loadFolders();
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
