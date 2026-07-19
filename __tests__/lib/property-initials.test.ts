import { describe, expect, it } from 'vitest';
import { propertyInitials } from '@/lib/property-initials';

describe('propertyInitials', () => {
  it('uses the first two words instead of a trailing unit number', () => {
    expect(propertyInitials('8TURF Commercial 1')).toBe('8C');
  });

  it('uses both words for a two-word property name', () => {
    expect(propertyInitials('8TURF Residences')).toBe('8R');
  });

  it('uses the first two characters for a one-word property name', () => {
    expect(propertyInitials('Commercial')).toBe('CO');
  });
});
