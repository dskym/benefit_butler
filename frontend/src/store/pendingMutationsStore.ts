import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { PendingMutation } from '../types';
import { createPlatformStorage } from '../storage';

interface PendingMutationsState {
  queue: PendingMutation[];
  enqueue: (m: Omit<PendingMutation, 'id' | 'createdAt'>) => string;
  dequeue: (id: string) => void;
  dequeueMany: (ids: string[]) => void;
  clearAll: () => void;
}

function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export const usePendingMutationsStore = create<PendingMutationsState>()(
  persist(
    (set) => ({
      queue: [],
      enqueue: (mutation) => {
        const id = generateId();
        set((s) => ({ queue: [...s.queue, { ...mutation, id, createdAt: Date.now() }] }));
        return id;
      },
      dequeue: (id) => set((s) => ({ queue: s.queue.filter((m) => m.id !== id) })),
      dequeueMany: (ids) => {
        const set_ = new Set(ids);
        set((s) => ({ queue: s.queue.filter((m) => !set_.has(m.id)) }));
      },
      clearAll: () => set({ queue: [] }),
    }),
    { name: 'pending-mutations', storage: createPlatformStorage() },
  ),
);
