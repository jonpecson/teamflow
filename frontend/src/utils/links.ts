const URL_REGEX = /https?:\/\/[^\s<>"{}|\\^`[\]]+/g;

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

/** Render markdown-like syntax: bold, italic, strikethrough, code, mentions */
function renderMarkdown(text: string): string {
  // Code blocks (``` ... ```)
  text = text.replace(/```([\s\S]*?)```/g, '<pre class="md-code-block">$1</pre>');
  // Inline code
  text = text.replace(/`([^`]+)`/g, '<code class="md-code">$1</code>');
  // Bold
  text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // Italic
  text = text.replace(/(?<!\w)_(.+?)_(?!\w)/g, '<em>$1</em>');
  // Strikethrough
  text = text.replace(/~~(.+?)~~/g, '<del>$1</del>');
  // Blockquote (lines starting with >)
  text = text.replace(/^&gt; (.+)$/gm, '<blockquote class="md-quote">$1</blockquote>');
  return text;
}

/** Render @mentions as colored pills */
function renderMentions(text: string): string {
  return text.replace(/@(\w+)/g, (match, username) => {
    const isSpecial = username === 'channel' || username === 'here';
    const cls = isSpecial ? 'mention-pill mention-special' : 'mention-pill';
    return `<span class="${cls}">@${escapeHtml(username)}</span>`;
  });
}

export function linkify(text: string): string {
  // First render markdown
  text = renderMarkdown(text);
  // Then linkify URLs
  text = text.replace(URL_REGEX, (url) => {
    // Don't linkify inside code blocks
    const escaped = escapeHtml(url);
    return `<a href="${escaped}" target="_blank" rel="noopener noreferrer" class="msg-link">${escaped}</a>`;
  });
  // Then render mentions
  text = renderMentions(text);
  return text;
}
