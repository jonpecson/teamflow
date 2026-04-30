const URL_REGEX = /https?:\/\/[^\s<>"{}|\\^`[\]]+/g;

export function linkify(text: string): string {
  return text.replace(URL_REGEX, (url) => {
    const escaped = escapeHtml(url);
    return `<a href="${escaped}" target="_blank" rel="noopener noreferrer" class="msg-link">${escaped}</a>`;
  });
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function escapeMessage(text: string): string {
  return escapeHtml(text);
}
