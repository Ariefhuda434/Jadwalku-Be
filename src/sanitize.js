function escapeHtml(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

function sanitize(obj, keys) {
  const result = { ...obj };
  for (const key of keys) {
    if (result[key] !== undefined && result[key] !== null) {
      result[key] = escapeHtml(result[key]);
    }
  }
  return result;
}

module.exports = { escapeHtml, sanitize };
