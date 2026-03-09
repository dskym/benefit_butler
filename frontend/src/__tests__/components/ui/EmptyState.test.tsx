import React from 'react';
import { render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { EmptyState } from '../../../components/ui/EmptyState';

describe('EmptyState', () => {
  it('renders icon, title, and subtitle', () => {
    const { getByText } = render(
      <EmptyState
        icon="📋"
        title="No items"
        subtitle="Add some items to get started"
      />
    );

    expect(getByText('📋')).toBeTruthy();
    expect(getByText('No items')).toBeTruthy();
    expect(getByText('Add some items to get started')).toBeTruthy();
  });

  it('renders without subtitle', () => {
    const { getByText, queryByText } = render(
      <EmptyState icon="🔍" title="No results" />
    );

    expect(getByText('🔍')).toBeTruthy();
    expect(getByText('No results')).toBeTruthy();
    // subtitle should not be rendered
    expect(queryByText('Add some items to get started')).toBeNull();
  });

  it('renders with action element', () => {
    const actionElement = <Text testID="action-btn">Add Item</Text>;
    const { getByTestId, getByText } = render(
      <EmptyState icon="📋" title="Empty" action={actionElement} />
    );

    expect(getByText('Empty')).toBeTruthy();
    expect(getByTestId('action-btn')).toBeTruthy();
  });

  it('does not render action when not provided', () => {
    const { queryByTestId } = render(
      <EmptyState icon="📋" title="Empty" />
    );

    expect(queryByTestId('action-btn')).toBeNull();
  });

  it('renders icon with correct text', () => {
    const { getByText } = render(
      <EmptyState icon="💰" title="No transactions" />
    );

    expect(getByText('💰')).toBeTruthy();
  });
});
