import { useToastStore } from '../../store/toastStore';

const INITIAL = { visible: false, message: '', type: 'success' as const };

beforeEach(() => {
  useToastStore.setState(INITIAL);
  jest.clearAllMocks();
});

describe('useToastStore', () => {
  it('showToast sets visible, message, and default type to success', () => {
    useToastStore.getState().showToast('저장되었습니다.');
    const state = useToastStore.getState();
    expect(state.visible).toBe(true);
    expect(state.message).toBe('저장되었습니다.');
    expect(state.type).toBe('success');
  });

  it('showToast sets custom type', () => {
    useToastStore.getState().showToast('오류 발생', 'error');
    const state = useToastStore.getState();
    expect(state.visible).toBe(true);
    expect(state.message).toBe('오류 발생');
    expect(state.type).toBe('error');
  });

  it('showToast with info type', () => {
    useToastStore.getState().showToast('알림 메시지', 'info');
    const state = useToastStore.getState();
    expect(state.visible).toBe(true);
    expect(state.type).toBe('info');
  });

  it('hideToast sets visible to false', () => {
    useToastStore.getState().showToast('테스트');
    expect(useToastStore.getState().visible).toBe(true);
    useToastStore.getState().hideToast();
    expect(useToastStore.getState().visible).toBe(false);
  });

  it('showToast overwrites previous toast', () => {
    useToastStore.getState().showToast('첫 번째', 'success');
    useToastStore.getState().showToast('두 번째', 'error');
    const state = useToastStore.getState();
    expect(state.message).toBe('두 번째');
    expect(state.type).toBe('error');
    expect(state.visible).toBe(true);
  });

  it('initial state is not visible with empty message', () => {
    const state = useToastStore.getState();
    expect(state.visible).toBe(false);
    expect(state.message).toBe('');
    expect(state.type).toBe('success');
  });
});
