import { describe, it, expect } from 'vitest';
import { AT_PRESS, latestIssue, validateIndex, validateIssue, safeHttps } from './issues';
import issue from '../../public/issues/2026-10-12.json';

const entry = { date: issue.date, number: issue.number, headline: issue.headline };
describe('issues are validated before rendering', () => {
  it('accepts the complete issue and legacy issues without deck/body', () => {
    expect(validateIssue(issue).body).toHaveLength(3);
    const { deck: _d, body: _b, ...legacy } = issue;
    expect(validateIssue(legacy).sections).toHaveLength(5);
  });
  it.each([null, {}, { ...issue, date: '2026-02-30' }, { ...issue, number: -1 }, { ...issue, headline: null }, { ...issue, body: 'paragraph' }, { ...issue, body: [null] }, { ...issue, deck: 23 }, { ...issue, sections: [{ title: 'News', items: [{ token: {} }] }] }, { ...issue, reporting: { sources: [{ title: 'Source', url: 'javascript:alert(1)' }] } }])('rejects invalid issue data', data => expect(() => validateIssue(data)).toThrow());
  it('rejects wrong-file dates', () => expect(() => validateIssue(issue, '2026-10-13')).toThrow());
  it.each([null, {}, [null], [{ ...entry, date: '../secret' }], [entry, entry], [{ ...entry, number: '1' }]])('rejects malformed indices', data => expect(() => validateIndex(data)).toThrow());
  it('rejects credentials and unsafe links', () => {
    expect(safeHttps('https://user:password@example.org')).toBeNull();
    expect(safeHttps('data:text/html,hello')).toBeNull();
    expect(safeHttps('https://example.org/story')).toBe('https://example.org/story');
  });
});
describe('the issue is at the press from UTC midnight', () => {
  const next = { ...entry, date: '2026-10-13', number: 2 };
  it('keeps the latest past issue while the next one is being filed', () => {
    expect(latestIssue([next, entry], '2026-10-12')).toEqual(entry);
    expect(latestIssue([entry], '2026-10-13')).toEqual(entry);
    expect(AT_PRESS).toBe("Today's issue is at the press. Here is the latest one.");
  });
  it('selects the newly filed issue, and never leaks a future issue', () => {
    expect(latestIssue([entry, next], '2026-10-13')).toEqual(next);
    expect(latestIssue([entry], '2026-10-11')).toBeNull();
  });
});
