// src/__tests__/screens/auth/LoginScreen.test.tsx

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
import LoginScreen from '../../../screens/auth/LoginScreen';
import { useAuthStore } from '../../../store/authStore';

const mockLogin = jest.fn();
const mockNavigation = { navigate: jest.fn() };

beforeEach(() => {
  jest.clearAllMocks();
  (useAuthStore as unknown as jest.Mock).mockReturnValue({
    login: mockLogin,
    isLoading: false,
  });
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

describe('LoginScreen', () => {
  it('renders email and password inputs', () => {
    const { getByPlaceholderText, getByText } = render(
      <LoginScreen navigation={mockNavigation} />
    );

    expect(getByPlaceholderText('Email')).toBeTruthy();
    expect(getByPlaceholderText('Password')).toBeTruthy();
    expect(getByText('Log In')).toBeTruthy();
  });

  it('shows inline error when email is empty on blur', () => {
    const { getByPlaceholderText, getByText } = render(
      <LoginScreen navigation={mockNavigation} />
    );

    fireEvent(getByPlaceholderText('Email'), 'blur');

    expect(getByText('이메일을 입력해주세요.')).toBeTruthy();
  });

  it('shows inline error for invalid email format on blur', () => {
    const { getByPlaceholderText, getByText } = render(
      <LoginScreen navigation={mockNavigation} />
    );

    fireEvent.changeText(getByPlaceholderText('Email'), 'invalid-email');
    fireEvent(getByPlaceholderText('Email'), 'blur');

    expect(getByText('올바른 이메일 형식이 아닙니다.')).toBeTruthy();
  });

  it('clears email error when valid email is entered on blur', () => {
    const { getByPlaceholderText, queryByText } = render(
      <LoginScreen navigation={mockNavigation} />
    );

    // Trigger error first
    fireEvent(getByPlaceholderText('Email'), 'blur');
    expect(queryByText('이메일을 입력해주세요.')).toBeTruthy();

    // Type valid email and blur
    fireEvent.changeText(getByPlaceholderText('Email'), 'test@example.com');
    fireEvent(getByPlaceholderText('Email'), 'blur');

    expect(queryByText('이메일을 입력해주세요.')).toBeNull();
    expect(queryByText('올바른 이메일 형식이 아닙니다.')).toBeNull();
  });

  it('clears field error when user starts typing', () => {
    const { getByPlaceholderText, queryByText } = render(
      <LoginScreen navigation={mockNavigation} />
    );

    // Trigger error
    fireEvent(getByPlaceholderText('Email'), 'blur');
    expect(queryByText('이메일을 입력해주세요.')).toBeTruthy();

    // Start typing - error should clear
    fireEvent.changeText(getByPlaceholderText('Email'), 'a');
    expect(queryByText('이메일을 입력해주세요.')).toBeNull();
  });

  it('shows inline error when password is empty on blur', () => {
    const { getByPlaceholderText, getByText } = render(
      <LoginScreen navigation={mockNavigation} />
    );

    fireEvent(getByPlaceholderText('Password'), 'blur');

    expect(getByText('비밀번호를 입력해주세요.')).toBeTruthy();
  });

  it('shows inline errors on submit when fields are empty', () => {
    const { getByLabelText, getByText } = render(
      <LoginScreen navigation={mockNavigation} />
    );

    fireEvent.press(getByLabelText('로그인'));

    expect(getByText('이메일을 입력해주세요.')).toBeTruthy();
    expect(getByText('비밀번호를 입력해주세요.')).toBeTruthy();
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it('shows email format error on submit with invalid email', () => {
    const { getByPlaceholderText, getByLabelText, getByText } = render(
      <LoginScreen navigation={mockNavigation} />
    );

    fireEvent.changeText(getByPlaceholderText('Email'), 'bad-email');
    fireEvent.changeText(getByPlaceholderText('Password'), 'password123');
    fireEvent.press(getByLabelText('로그인'));

    expect(getByText('올바른 이메일 형식이 아닙니다.')).toBeTruthy();
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it('does not show Alert.alert for validation errors', () => {
    const { getByLabelText } = render(
      <LoginScreen navigation={mockNavigation} />
    );

    fireEvent.press(getByLabelText('로그인'));

    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('calls login with trimmed email on successful submit', async () => {
    mockLogin.mockResolvedValue(undefined);
    const { getByPlaceholderText, getByLabelText } = render(
      <LoginScreen navigation={mockNavigation} />
    );

    fireEvent.changeText(getByPlaceholderText('Email'), '  test@example.com  ');
    fireEvent.changeText(getByPlaceholderText('Password'), 'password123');
    fireEvent.press(getByLabelText('로그인'));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('test@example.com', 'password123');
    });
  });

  it('shows Alert.alert for server-side API errors', async () => {
    mockLogin.mockRejectedValue({
      response: { data: { detail: 'Invalid credentials' } },
    });

    const { getByPlaceholderText, getByLabelText } = render(
      <LoginScreen navigation={mockNavigation} />
    );

    fireEvent.changeText(getByPlaceholderText('Email'), 'test@example.com');
    fireEvent.changeText(getByPlaceholderText('Password'), 'wrong-password');
    fireEvent.press(getByLabelText('로그인'));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith('Login Failed', 'Invalid credentials');
    });
  });

  it('navigates to Register screen', () => {
    const { getByLabelText } = render(
      <LoginScreen navigation={mockNavigation} />
    );

    fireEvent.press(getByLabelText('회원가입 화면으로 이동'));

    expect(mockNavigation.navigate).toHaveBeenCalledWith('Register');
  });
});
