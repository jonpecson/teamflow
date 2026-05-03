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

/** Render markdown syntax: headings, bold, italic, strikethrough, code, lists, hr, blockquotes */
function renderMarkdown(text: string): string {
  // Code blocks (``` ... ```) — extract first to protect from other transforms
  const codeBlocks: string[] = [];
  text = text.replace(/```([\s\S]*?)```/g, (_, code) => {
    codeBlocks.push(code);
    return `\x00CB${codeBlocks.length - 1}\x00`;
  });

  // Inline code — extract to protect
  const inlineCodes: string[] = [];
  text = text.replace(/`([^`]+)`/g, (_, code) => {
    inlineCodes.push(code);
    return `\x00IC${inlineCodes.length - 1}\x00`;
  });

  // Headings (# to ######)
  text = text.replace(/^#{6}\s+(.+)$/gm, '<h6 class="md-heading md-h6">$1</h6>');
  text = text.replace(/^#{5}\s+(.+)$/gm, '<h5 class="md-heading md-h5">$1</h5>');
  text = text.replace(/^#{4}\s+(.+)$/gm, '<h4 class="md-heading md-h4">$1</h4>');
  text = text.replace(/^###\s+(.+)$/gm, '<h3 class="md-heading md-h3">$1</h3>');
  text = text.replace(/^##\s+(.+)$/gm, '<h2 class="md-heading md-h2">$1</h2>');
  text = text.replace(/^#\s+(.+)$/gm, '<h1 class="md-heading md-h1">$1</h1>');

  // Horizontal rule (--- or *** or ___ on its own line)
  text = text.replace(/^(-{3,}|\*{3,}|_{3,})$/gm, '<hr class="md-hr"/>');

  // Bold + italic (***text*** or ___text___)
  text = text.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  text = text.replace(/___(.+?)___/g, '<strong><em>$1</em></strong>');

  // Bold (**text** or __text__)
  text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/__(.+?)__/g, '<strong>$1</strong>');

  // Italic (*text* or _text_)
  text = text.replace(/(?<!\w)\*([^*\n]+)\*(?!\w)/g, '<em>$1</em>');
  text = text.replace(/(?<!\w)_([^_\n]+)_(?!\w)/g, '<em>$1</em>');

  // Strikethrough
  text = text.replace(/~~(.+?)~~/g, '<del>$1</del>');

  // Unordered lists (- item or * item)
  text = text.replace(/^[\-\*]\s+(.+)$/gm, '<li class="md-li">$1</li>');
  // Wrap consecutive <li> in <ul>
  text = text.replace(/((?:<li class="md-li">.*<\/li>\n?)+)/g, '<ul class="md-ul">$1</ul>');

  // Ordered lists (1. item)
  text = text.replace(/^\d+\.\s+(.+)$/gm, '<li class="md-li md-ol-li">$1</li>');
  text = text.replace(/((?:<li class="md-li md-ol-li">.*<\/li>\n?)+)/g, '<ol class="md-ol">$1</ol>');

  // Blockquote (lines starting with >)
  text = text.replace(/^&gt;\s*(.+)$/gm, '<blockquote class="md-quote">$1</blockquote>');
  // Merge consecutive blockquotes
  text = text.replace(/<\/blockquote>\n<blockquote class="md-quote">/g, '<br/>');

  // Restore inline code
  text = text.replace(/\x00IC(\d+)\x00/g, (_, i) => `<code class="md-code">${inlineCodes[parseInt(i)]}</code>`);

  // Restore code blocks
  text = text.replace(/\x00CB(\d+)\x00/g, (_, i) => `<pre class="md-code-block">${codeBlocks[parseInt(i)]}</pre>`);

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
  // Then linkify URLs (skip inside code/pre tags)
  text = text.replace(URL_REGEX, (url) => {
    const escaped = escapeHtml(url);
    return `<a href="${escaped}" target="_blank" rel="noopener noreferrer" class="msg-link">${escaped}</a>`;
  });
  // Then render mentions
  text = renderMentions(text);
  return text;
}
