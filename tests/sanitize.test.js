const { escapeHtml, sanitize } = require('../src/sanitize');

describe('escapeHtml', () => {
  it('escapes & < > " \'', () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
  });

  it('escapes ampersand first', () => {
    expect(escapeHtml('a&b')).toBe('a&amp;b');
  });

  it('returns non-string as-is', () => {
    expect(escapeHtml(123)).toBe(123);
    expect(escapeHtml(null)).toBe(null);
    expect(escapeHtml(undefined)).toBe(undefined);
  });

  it('returns empty string unchanged', () => {
    expect(escapeHtml('')).toBe('');
  });
});

describe('sanitize', () => {
  it('escapes specified keys only', () => {
    const input = { name: '<b>bold</b>', age: 25, desc: 'safe' };
    const result = sanitize(input, ['name']);
    expect(result.name).toBe('&lt;b&gt;bold&lt;/b&gt;');
    expect(result.age).toBe(25);
    expect(result.desc).toBe('safe');
  });

  it('handles missing keys gracefully', () => {
    const result = sanitize({ a: 'hello' }, ['a', 'b']);
    expect(result.a).toBe('hello');
    expect(result.b).toBeUndefined();
  });
});
