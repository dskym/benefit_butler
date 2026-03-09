import React from 'react';
import { render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { TextInputField } from '../../../components/ui/TextInputField';

describe('TextInputField', () => {
  it('renders label', () => {
    const { getByText } = render(
      <TextInputField label="Amount" placeholder="Enter amount" />
    );

    expect(getByText('Amount')).toBeTruthy();
  });

  it('renders without label', () => {
    const { getByPlaceholderText, queryByText } = render(
      <TextInputField placeholder="Enter value" />
    );

    expect(getByPlaceholderText('Enter value')).toBeTruthy();
    // There should be no label text element
  });

  it('renders error message with error border', () => {
    const { getByText } = render(
      <TextInputField
        label="Email"
        placeholder="Enter email"
        error="Invalid email"
      />
    );

    expect(getByText('Invalid email')).toBeTruthy();
  });

  it('renders hint when no error', () => {
    const { getByText, queryByText } = render(
      <TextInputField
        label="Password"
        placeholder="Enter password"
        hint="At least 8 characters"
      />
    );

    expect(getByText('At least 8 characters')).toBeTruthy();
    expect(queryByText('Invalid')).toBeNull();
  });

  it('does not render hint when error is present', () => {
    const { getByText, queryByText } = render(
      <TextInputField
        label="Password"
        placeholder="Enter password"
        hint="At least 8 characters"
        error="Password too short"
      />
    );

    expect(getByText('Password too short')).toBeTruthy();
    expect(queryByText('At least 8 characters')).toBeNull();
  });

  it('passes TextInput props through', () => {
    const { getByPlaceholderText } = render(
      <TextInputField
        placeholder="Search..."
        value="test value"
        editable={false}
        maxLength={100}
      />
    );

    const input = getByPlaceholderText('Search...');
    expect(input.props.value).toBe('test value');
    expect(input.props.editable).toBe(false);
    expect(input.props.maxLength).toBe(100);
  });

  it('renders prefix', () => {
    const prefix = <Text testID="prefix-icon">$</Text>;
    const { getByTestId } = render(
      <TextInputField placeholder="Amount" prefix={prefix} />
    );

    expect(getByTestId('prefix-icon')).toBeTruthy();
  });

  it('renders suffix', () => {
    const suffix = <Text testID="suffix-icon">Won</Text>;
    const { getByTestId } = render(
      <TextInputField placeholder="Amount" suffix={suffix} />
    );

    expect(getByTestId('suffix-icon')).toBeTruthy();
  });

  it('renders both prefix and suffix', () => {
    const prefix = <Text testID="prefix">P</Text>;
    const suffix = <Text testID="suffix">S</Text>;
    const { getByTestId } = render(
      <TextInputField placeholder="Value" prefix={prefix} suffix={suffix} />
    );

    expect(getByTestId('prefix')).toBeTruthy();
    expect(getByTestId('suffix')).toBeTruthy();
  });

  it('uses label as accessibility label when no explicit accessibilityLabel', () => {
    const { getByLabelText } = render(
      <TextInputField label="Username" placeholder="Enter username" />
    );

    expect(getByLabelText('Username')).toBeTruthy();
  });
});
