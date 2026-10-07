import { describe, expect, it } from 'vitest';
import { tickFor } from './ticks';

const A = '01J00000000000000000000000';
const B = '01J00000000000000000000005';
const C = '01J00000000000000000000009';

describe('tickFor', () => {
  it('is sent until every other member has it', () => {
    const marks = [
      { userId: 'me', delivered: null, read: null },
      { userId: 'x', delivered: C, read: null },
      { userId: 'y', delivered: A, read: null },
    ];
    expect(tickFor(B, 'me', marks)).toBe('sent');
  });

  it('is delivered when all others delivered, read when all others read', () => {
    const marks = [
      { userId: 'me', delivered: null, read: null },
      { userId: 'x', delivered: C, read: C },
      { userId: 'y', delivered: C, read: A },
    ];
    expect(tickFor(B, 'me', marks)).toBe('delivered');
    expect(tickFor(A, 'me', marks)).toBe('read');
  });

  it('treats read as implying delivered', () => {
    expect(tickFor(B, 'me', [{ userId: 'x', delivered: null, read: C }])).toBe('read');
  });

  it('ignores the sender’s own watermark', () => {
    expect(tickFor(B, 'me', [{ userId: 'me', delivered: null, read: null }])).toBe('sent');
  });
});
