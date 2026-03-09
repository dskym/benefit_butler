import { formatWithCommas, stripCommas } from '../../utils/formatCurrency';

describe('formatCurrency', () => {
  describe('formatWithCommas', () => {
    it('returns empty string for empty input', () => {
      expect(formatWithCommas('')).toBe('');
    });

    it('formats thousands', () => {
      expect(formatWithCommas('15000')).toBe('15,000');
    });

    it('formats millions', () => {
      expect(formatWithCommas('1000000')).toBe('1,000,000');
    });

    it('returns empty for non-numeric input', () => {
      expect(formatWithCommas('abc')).toBe('');
    });

    it('handles single digit', () => {
      expect(formatWithCommas('5')).toBe('5');
    });

    it('handles zero', () => {
      expect(formatWithCommas('0')).toBe('0');
    });

    it('strips non-digits before formatting', () => {
      // Input "12,345" contains commas (non-digits); they are stripped, then re-formatted
      expect(formatWithCommas('12,345')).toBe('12,345');
    });

    it('formats large numbers correctly', () => {
      expect(formatWithCommas('1234567890')).toBe('1,234,567,890');
    });

    it('handles string with mixed digits and letters', () => {
      // "1a2b3" -> digits "123" -> "123"
      expect(formatWithCommas('1a2b3')).toBe('123');
    });
  });

  describe('stripCommas', () => {
    it('removes commas from formatted string', () => {
      expect(stripCommas('15,000')).toBe('15000');
    });

    it('removes multiple commas', () => {
      expect(stripCommas('1,000,000')).toBe('1000000');
    });

    it('handles string without commas', () => {
      expect(stripCommas('abc')).toBe('abc');
    });

    it('handles empty string', () => {
      expect(stripCommas('')).toBe('');
    });

    it('handles pure digits without commas', () => {
      expect(stripCommas('15000')).toBe('15000');
    });
  });
});
