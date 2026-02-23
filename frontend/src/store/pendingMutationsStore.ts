import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { PendingMutation } from '../types';
import { createPlatformStorage } from '../storage';

interface PendingMutationsState {
  queue: PendingMutation[];
  enqueue: (m: Omit<PendingMutation, 'id' | 'createdAt' | 'retryCount'>) => string;
  dequeue: (id: string) => void;
  dequeueMany: (ids: string[]) => void;
  clearAll: () => void;
  incrementRetry: (id: string) => void;
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
        set((s) => ({ queue: [...s.queue, { ...mutation, id, createdAt: Date.now(), retryCount: 0 }] }));
        return id;
      },
      dequeue: (id) => set((s) => ({ queue: s.queue.filter((m) => m.id !== id) })),
      dequeueMany: (ids) => {
        const set_ = new Set(ids);
        set((s) => ({ queue: s.queue.filter((m) => !set_.has(m.id)) }));
      },
      clearAll: () => set({ queue: [] }),
      incrementRetry: (id) =>
        set((s) => ({
          queue: s.queue.map((m) => (m.id === id ? { ...m, retryCount: m.retryCount + 1 } : m)),
        })),
    }),
    { name: 'pending-mutations', storage: createPlatformStorage() },
  ),
);
