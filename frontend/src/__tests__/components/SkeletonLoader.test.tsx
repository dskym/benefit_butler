import React from 'react';
import { Animated } from 'react-native';
import { render } from '@testing-library/react-native';
import { TransactionSkeleton, SkeletonItem } from '../../components/SkeletonLoader';

// Prevent Animated loop from running in tests
jest.spyOn(Animated, 'loop').mockReturnValue({ start: jest.fn(), stop: jest.fn(), reset: jest.fn() } as any);

describe('SkeletonLoader', () => {
  describe('TransactionSkeleton', () => {
    it('renders correct number of rows with default count (5)', () => {
      const { toJSON } = render(<TransactionSkeleton />);
      const tree = toJSON() as any;

      // The container has `count` children (each is a row View)
      expect(tree.children).toHaveLength(5);
    });

    it('renders custom count of rows', () => {
      const { toJSON } = render(<TransactionSkeleton count={3} />);
      const tree = toJSON() as any;

      expect(tree.children).toHaveLength(3);
    });

    it('renders zero rows when count is 0', () => {
      const { toJSON } = render(<TransactionSkeleton count={0} />);
      const tree = toJSON() as any;

      // No children when count is 0
      expect(tree.children).toBeNull();
    });

    it('renders 1 row correctly', () => {
      const { toJSON } = render(<TransactionSkeleton count={1} />);
      const tree = toJSON() as any;

      expect(tree.children).toHaveLength(1);
    });

    it('each row contains skeleton items for avatar, text, and amount', () => {
      const { toJSON } = render(<TransactionSkeleton count={1} />);
      const tree = toJSON() as any;
      const row = tree.children[0];

      // Row has two main children: left group and amount skeleton
      expect(row.children).toHaveLength(2);

      // Left group contains avatar skeleton and text group
      const leftGroup = row.children[0];
      expect(leftGroup.children).toHaveLength(2); // avatar SkeletonItem + textGroup

      // Text group contains two SkeletonItems (title + subtitle)
      const textGroup = leftGroup.children[1];
      expect(textGroup.children).toHaveLength(2);
    });
  });

  describe('SkeletonItem', () => {
    it('renders with given dimensions', () => {
      const { toJSON } = render(
        <SkeletonItem width={100} height={20} />
      );
      const tree = toJSON() as any;

      // SkeletonItem renders an Animated.View with style props
      expect(tree).toBeTruthy();

      // Verify the style contains the specified dimensions
      const flatStyle = flattenStyle(tree.props.style);
      expect(flatStyle.width).toBe(100);
      expect(flatStyle.height).toBe(20);
    });

    it('renders with default dimensions', () => {
      const { toJSON } = render(<SkeletonItem />);
      const tree = toJSON() as any;

      const flatStyle = flattenStyle(tree.props.style);
      // Defaults: width = "100%", height = 16
      expect(flatStyle.width).toBe('100%');
      expect(flatStyle.height).toBe(16);
    });

    it('renders with custom borderRadius', () => {
      const { toJSON } = render(
        <SkeletonItem width={40} height={40} borderRadius={20} />
      );
      const tree = toJSON() as any;

      const flatStyle = flattenStyle(tree.props.style);
      expect(flatStyle.borderRadius).toBe(20);
    });

    it('applies custom style prop', () => {
      const { toJSON } = render(
        <SkeletonItem width={80} height={12} style={{ marginTop: 6 }} />
      );
      const tree = toJSON() as any;

      const flatStyle = flattenStyle(tree.props.style);
      expect(flatStyle.marginTop).toBe(6);
    });
  });
});

/**
 * Helper to flatten an array of style objects into a single object.
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
