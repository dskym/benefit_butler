jest.mock('../../storage', () => ({
  mmkvStorage: { getItem: jest.fn().mockReturnValue(null), setItem: jest.fn(), removeItem: jest.fn() },
  createPlatformStorage: jest.fn(() => ({
    getItem: jest.fn().mockReturnValue(null),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  })),
}));
jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));

import { usePendingMutationsStore } from '../../store/pendingMutationsStore';

const make = (overrides = {}) => ({
  type: 'CREATE' as const, resource: 'transaction' as const,
  payload: { amount: 5000 }, ...overrides,
});

beforeEach(() => {
  usePendingMutationsStore.setState({ queue: [] });
  jest.clearAllMocks();
});

describe('enqueue', () => {
  it('adds mutation and returns id', () => {
    const id = usePendingMutationsStore.getState().enqueue(make());
    expect(usePendingMutationsStore.getState().queue).toHaveLength(1);
    expect(usePendingMutationsStore.getState().queue[0].id).toBe(id);
  });
  it('assigns unique ids', () => {
    const id1 = usePendingMutationsStore.getState().enqueue(make());
    const id2 = usePendingMutationsStore.getState().enqueue(make());
    expect(id1).not.toBe(id2);
  });
  it('preserves insertion order', () => {
    const id1 = usePendingMutationsStore.getState().enqueue(make({ type: 'CREATE' }));
    const id2 = usePendingMutationsStore.getState().enqueue(make({ type: 'UPDATE' }));
    const { queue } = usePendingMutationsStore.getState();
    expect(queue[0].id).toBe(id1);
    expect(queue[1].id).toBe(id2);
  });
  it('stores localId for CREATE', () => {
    usePendingMutationsStore.getState().enqueue(make({ localId: 'local-123' }));
    expect(usePendingMutationsStore.getState().queue[0].localId).toBe('local-123');
  });
});

describe('dequeue', () => {
  it('removes mutation by id', () => {
    const id1 = usePendingMutationsStore.getState().enqueue(make());
    const id2 = usePendingMutationsStore.getState().enqueue(make());
    usePendingMutationsStore.getState().dequeue(id1);
    expect(usePendingMutationsStore.getState().queue).toHaveLength(1);
    expect(usePendingMutationsStore.getState().queue[0].id).toBe(id2);
  });
  it('does nothing for unknown id', () => {
    usePendingMutationsStore.getState().enqueue(make());
    usePendingMutationsStore.getState().dequeue('nonexistent');
    expect(usePendingMutationsStore.getState().queue).toHaveLength(1);
  });
});

describe('dequeueMany', () => {
  it('removes all matching ids', () => {
    const id1 = usePendingMutationsStore.getState().enqueue(make());
    const id2 = usePendingMutationsStore.getState().enqueue(make());
    const id3 = usePendingMutationsStore.getState().enqueue(make());
    usePendingMutationsStore.getState().dequeueMany([id1, id3]);
    expect(usePendingMutationsStore.getState().queue).toHaveLength(1);
    expect(usePendingMutationsStore.getState().queue[0].id).toBe(id2);
  });
});

describe('clearAll', () => {
  it('empties the queue', () => {
    usePendingMutationsStore.getState().enqueue(make());
    usePendingMutationsStore.getState().enqueue(make());
    usePendingMutationsStore.getState().clearAll();
    expect(usePendingMutationsStore.getState().queue).toHaveLength(0);
  });
});

describe('retryCount', () => {
  it('enqueue 시 retryCount: 0으로 초기화된다', () => {
    const id = usePendingMutationsStore.getState().enqueue(make());
    expect(usePendingMutationsStore.getState().queue.find((m) => m.id === id)?.retryCount).toBe(0);
  });

  it('incrementRetry가 해당 mutation의 retryCount를 1 증가시킨다', () => {
    const id = usePendingMutationsStore.getState().enqueue(make());
    usePendingMutationsStore.getState().incrementRetry(id);
    expect(usePendingMutationsStore.getState().queue.find((m) => m.id === id)?.retryCount).toBe(1);
  });

  it('incrementRetry는 다른 mutation에 영향을 주지 않는다', () => {
    const id1 = usePendingMutationsStore.getState().enqueue(make());
    const id2 = usePendingMutationsStore.getState().enqueue(make());
    usePendingMutationsStore.getState().incrementRetry(id1);
    expect(usePendingMutationsStore.getState().queue.find((m) => m.id === id2)?.retryCount).toBe(0);
  });
});
