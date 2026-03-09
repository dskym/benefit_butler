// src/__tests__/screens/auth/RegisterScreen.test.tsx

jest.mock('../../../store/authStore', () => ({
  useAuthStore: jest.fn(),
}));

jest.mock('../../../storage', () => ({
  mmkvStorage: { getItem: jest.fn().mockReturnValue(null), setItem: jest.fn(), removeItem: jest.fn() },
  createPlatformStorage: jest.fn(() => ({
    getItem: jest.fn().mockReturnValue(null), setItem: jest.fn(), removeItem: jest.fn(),
  })),
}));

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import RegisterScreen from '../../../screens/auth/RegisterScreen';
import { useAuthStore } from '../../../store/authStore';

const mockRegister = jest.fn();
const mockNavigation = { goBack: jest.fn() };

beforeEach(() => {
  jest.clearAllMocks();
  (useAuthStore as unknown as jest.Mock).mockReturnValue({
    register: mockRegister,
    isLoading: false,
  });
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

describe('RegisterScreen', () => {
  it('renders name, email, and password inputs', () => {
    const { getByPlaceholderText, getByText } = render(
      <RegisterScreen navigation={mockNavigation} />
    );

    expect(getByPlaceholderText('Name')).toBeTruthy();
    expect(getByPlaceholderText('Email')).toBeTruthy();
    expect(getByPlaceholderText('Password (min 6 characters)')).toBeTruthy();
    expect(getByText('Register')).toBeTruthy();
  });

  it('shows inline error when name is empty on blur', () => {
    const { getByPlaceholderText, getByText } = render(
      <RegisterScreen navigation={mockNavigation} />
    );

    fireEvent(getByPlaceholderText('Name'), 'blur');

    expect(getByText('이름을 입력해주세요.')).toBeTruthy();
  });

  it('shows inline error when email is empty on blur', () => {
    const { getByPlaceholderText, getByText } = render(
      <RegisterScreen navigation={mockNavigation} />
    );

    fireEvent(getByPlaceholderText('Email'), 'blur');

    expect(getByText('이메일을 입력해주세요.')).toBeTruthy();
  });

  it('shows inline error for invalid email format on blur', () => {
    const { getByPlaceholderText, getByText } = render(
      <RegisterScreen navigation={mockNavigation} />
    );

    fireEvent.changeText(getByPlaceholderText('Email'), 'not-an-email');
    fireEvent(getByPlaceholderText('Email'), 'blur');

    expect(getByText('올바른 이메일 형식이 아닙니다.')).toBeTruthy();
  });

  it('shows inline error when password is empty on blur', () => {
    const { getByPlaceholderText, getByText } = render(
      <RegisterScreen navigation={mockNavigation} />
    );

    fireEvent(getByPlaceholderText('Password (min 6 characters)'), 'blur');

    expect(getByText('비밀번호를 입력해주세요.')).toBeTruthy();
  });

  it('shows inline error for password shorter than 6 characters on blur', () => {
    const { getByPlaceholderText, getByText } = render(
      <RegisterScreen navigation={mockNavigation} />
    );

    fireEvent.changeText(getByPlaceholderText('Password (min 6 characters)'), '12345');
    fireEvent(getByPlaceholderText('Password (min 6 characters)'), 'blur');

    expect(getByText('비밀번호는 6자 이상이어야 합니다.')).toBeTruthy();
  });

  it('clears password error when valid password is entered on blur', () => {
    const { getByPlaceholderText, queryByText } = render(
      <RegisterScreen navigation={mockNavigation} />
    );

    // Trigger error
    fireEvent.changeText(getByPlaceholderText('Password (min 6 characters)'), '123');
    fireEvent(getByPlaceholderText('Password (min 6 characters)'), 'blur');
    expect(queryByText('비밀번호는 6자 이상이어야 합니다.')).toBeTruthy();

    // Fix and blur again
    fireEvent.changeText(getByPlaceholderText('Password (min 6 characters)'), '123456');
    fireEvent(getByPlaceholderText('Password (min 6 characters)'), 'blur');
    expect(queryByText('비밀번호는 6자 이상이어야 합니다.')).toBeNull();
  });

  it('clears field error when user starts typing', () => {
    const { getByPlaceholderText, queryByText } = render(
      <RegisterScreen navigation={mockNavigation} />
    );

    // Trigger error
    fireEvent(getByPlaceholderText('Name'), 'blur');
    expect(queryByText('이름을 입력해주세요.')).toBeTruthy();

    // Start typing
    fireEvent.changeText(getByPlaceholderText('Name'), 'J');
    expect(queryByText('이름을 입력해주세요.')).toBeNull();
  });

  it('shows all inline errors on submit when all fields are empty', () => {
    const { getByLabelText, getByText } = render(
      <RegisterScreen navigation={mockNavigation} />
    );

    fireEvent.press(getByLabelText('회원가입'));

    expect(getByText('이름을 입력해주세요.')).toBeTruthy();
    expect(getByText('이메일을 입력해주세요.')).toBeTruthy();
    expect(getByText('비밀번호를 입력해주세요.')).toBeTruthy();
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('shows password min length error on submit', () => {
    const { getByPlaceholderText, getByLabelText, getByText } = render(
      <RegisterScreen navigation={mockNavigation} />
    );

    fireEvent.changeText(getByPlaceholderText('Name'), 'Test');
    fireEvent.changeText(getByPlaceholderText('Email'), 'test@example.com');
    fireEvent.changeText(getByPlaceholderText('Password (min 6 characters)'), '12345');
    fireEvent.press(getByLabelText('회원가입'));

    expect(getByText('비밀번호는 6자 이상이어야 합니다.')).toBeTruthy();
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('does not show Alert.alert for validation errors', () => {
    const { getByLabelText } = render(
      <RegisterScreen navigation={mockNavigation} />
    );

    fireEvent.press(getByLabelText('회원가입'));

    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('calls register with trimmed values on successful submit', async () => {
    mockRegister.mockResolvedValue(undefined);
    const { getByPlaceholderText, getByLabelText } = render(
      <RegisterScreen navigation={mockNavigation} />
    );

    fireEvent.changeText(getByPlaceholderText('Name'), '  Test User  ');
    fireEvent.changeText(getByPlaceholderText('Email'), '  test@example.com  ');
    fireEvent.changeText(getByPlaceholderText('Password (min 6 characters)'), 'password123');
    fireEvent.press(getByLabelText('회원가입'));

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith('test@example.com', 'password123', 'Test User');
    });
  });

  it('shows Alert.alert for server-side API errors', async () => {
    mockRegister.mockRejectedValue({
      response: { data: { detail: 'Email already registered' } },
    });

    const { getByPlaceholderText, getByLabelText } = render(
      <RegisterScreen navigation={mockNavigation} />
    );

    fireEvent.changeText(getByPlaceholderText('Name'), 'Test');
    fireEvent.changeText(getByPlaceholderText('Email'), 'test@example.com');
    fireEvent.changeText(getByPlaceholderText('Password (min 6 characters)'), 'password123');
    fireEvent.press(getByLabelText('회원가입'));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith('Registration Failed', 'Email already registered');
    });
  });

  it('navigates back to Login screen', () => {
    const { getByLabelText } = render(
      <RegisterScreen navigation={mockNavigation} />
    );

    fireEvent.press(getByLabelText('로그인 화면으로 이동'));

    expect(mockNavigation.goBack).toHaveBeenCalled();
  });
});
