import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Text } from 'react-native';
import { Button } from '../../../components/ui/Button';

describe('Button', () => {
  const defaultProps = {
    label: 'Test Button',
    onPress: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders label text', () => {
    const { getByText } = render(<Button {...defaultProps} />);
    expect(getByText('Test Button')).toBeTruthy();
  });

  it('calls onPress when pressed', () => {
    const onPress = jest.fn();
    const { getByText } = render(<Button {...defaultProps} onPress={onPress} />);

    fireEvent.press(getByText('Test Button'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not call onPress when disabled', () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <Button {...defaultProps} onPress={onPress} disabled />
    );

    fireEvent.press(getByText('Test Button'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('shows ActivityIndicator when loading', () => {
    const { getByRole, queryByText } = render(
      <Button {...defaultProps} loading />
    );

    // ActivityIndicator should be present; label should not be visible
    // When loading, the button renders ActivityIndicator instead of label
    expect(queryByText('Test Button')).toBeNull();
  });

  it('does not show label when loading', () => {
    const { queryByText } = render(<Button {...defaultProps} loading />);
    expect(queryByText('Test Button')).toBeNull();
  });

  it('does not call onPress when loading', () => {
    const onPress = jest.fn();
    const { getByRole } = render(
      <Button {...defaultProps} onPress={onPress} loading />
    );

    fireEvent.press(getByRole('button'));
    expect(onPress).not.toHaveBeenCalled();
  });

  describe('variant styles', () => {
    it('applies primary variant styles by default', () => {
      const { getByRole } = render(<Button {...defaultProps} />);
      const button = getByRole('button');
      // primary variant has backgroundColor: theme.colors.primary (#3182F6)
      const flatStyle = flattenStyle(button.props.style);
      expect(flatStyle.backgroundColor).toBe('#3182F6');
    });

    it('applies secondary variant styles', () => {
      const { getByRole } = render(
        <Button {...defaultProps} variant="secondary" />
      );
      const button = getByRole('button');
      const flatStyle = flattenStyle(button.props.style);
      expect(flatStyle.borderWidth).toBe(1);
      expect(flatStyle.backgroundColor).toBe('transparent');
    });

    it('applies danger variant styles', () => {
      const { getByRole } = render(
        <Button {...defaultProps} variant="danger" />
      );
      const button = getByRole('button');
      const flatStyle = flattenStyle(button.props.style);
      // danger variant: backgroundColor = theme.colors.expense (#F04452)
      expect(flatStyle.backgroundColor).toBe('#F04452');
    });

    it('applies ghost variant styles', () => {
      const { getByRole } = render(
        <Button {...defaultProps} variant="ghost" />
      );
      const button = getByRole('button');
      const flatStyle = flattenStyle(button.props.style);
      expect(flatStyle.backgroundColor).toBe('transparent');
    });
  });

  describe('size styles', () => {
    it('applies sm size styles', () => {
      const { getByRole } = render(<Button {...defaultProps} size="sm" />);
      const button = getByRole('button');
      const flatStyle = flattenStyle(button.props.style);
      expect(flatStyle.paddingVertical).toBe(8);
      expect(flatStyle.paddingHorizontal).toBe(12);
    });

    it('applies md size styles by default', () => {
      const { getByRole } = render(<Button {...defaultProps} />);
      const button = getByRole('button');
      const flatStyle = flattenStyle(button.props.style);
      expect(flatStyle.paddingVertical).toBe(14);
      expect(flatStyle.paddingHorizontal).toBe(16);
    });

    it('applies lg size styles', () => {
      const { getByRole } = render(<Button {...defaultProps} size="lg" />);
      const button = getByRole('button');
      const flatStyle = flattenStyle(button.props.style);
      expect(flatStyle.paddingVertical).toBe(16);
      expect(flatStyle.paddingHorizontal).toBe(20);
    });
  });

  it('renders icon when provided', () => {
    const icon = <Text testID="test-icon">Icon</Text>;
    const { getByTestId, getByText } = render(
      <Button {...defaultProps} icon={icon} />
    );

    expect(getByTestId('test-icon')).toBeTruthy();
    expect(getByText('Test Button')).toBeTruthy();
  });

  it('applies flex style when flex prop is set', () => {
    const { getByRole } = render(<Button {...defaultProps} flex={1} />);
    const button = getByRole('button');
    const flatStyle = flattenStyle(button.props.style);
    expect(flatStyle.flex).toBe(1);
  });

  it('has correct accessibility role and label', () => {
    const { getByRole } = render(<Button {...defaultProps} />);
    const button = getByRole('button');
    expect(button.props.accessibilityLabel).toBe('Test Button');
  });

  it('uses custom accessibilityLabel when provided', () => {
    const { getByRole } = render(
      <Button {...defaultProps} accessibilityLabel="Custom Label" />
    );
    const button = getByRole('button');
    expect(button.props.accessibilityLabel).toBe('Custom Label');
  });

  it('applies reduced opacity when disabled', () => {
    const { getByRole } = render(<Button {...defaultProps} disabled />);
    const button = getByRole('button');
    const flatStyle = flattenStyle(button.props.style);
    expect(flatStyle.opacity).toBe(0.4);
  });
});

/**
 * Helper to flatten an array of style objects into a single object.
 * Later entries override earlier ones (like RN StyleSheet.flatten).
 */
function flattenStyle(style: any): Record<string, any> {
  if (!style) return {};
  if (Array.isArray(style)) {
    return style.reduce(
      (acc: Record<string, any>, s: any) => ({ ...acc, ...flattenStyle(s) }),
      {}
    );
  }
  if (typeof style === 'object') return style;
  return {};
}
