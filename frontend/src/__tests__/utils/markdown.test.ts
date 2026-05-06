import { describe, it, expect } from 'vitest';
import { linkify, escapeMessage } from '../../utils/links';

describe('Markdown rendering', () => {
  it('renders headings', () => {
    expect(linkify(escapeMessage('# Title'))).toContain('<h1 class="md-heading md-h1">Title</h1>');
    expect(linkify(escapeMessage('## Subtitle'))).toContain('<h2 class="md-heading md-h2">Subtitle</h2>');
    expect(linkify(escapeMessage('### H3'))).toContain('<h3 class="md-heading md-h3">H3</h3>');
  });

  it('renders bold text', () => {
    expect(linkify(escapeMessage('**bold**'))).toContain('<strong>bold</strong>');
    expect(linkify(escapeMessage('__also bold__'))).toContain('<strong>also bold</strong>');
  });

  it('renders italic text', () => {
    expect(linkify(escapeMessage('*italic*'))).toContain('<em>italic</em>');
    expect(linkify(escapeMessage('_also italic_'))).toContain('<em>also italic</em>');
  });

  it('renders strikethrough', () => {
    expect(linkify(escapeMessage('~~removed~~'))).toContain('<del>removed</del>');
  });

  it('renders inline code', () => {
    expect(linkify(escapeMessage('use `npm install`'))).toContain('<code class="md-code">npm install</code>');
  });

  it('renders code blocks', () => {
    const input = '```\nconst x = 1;\n```';
    expect(linkify(escapeMessage(input))).toContain('<pre class="md-code-block">');
  });

  it('renders unordered lists', () => {
    const input = '- item one\n- item two';
    const result = linkify(escapeMessage(input));
    expect(result).toContain('<ul class="md-ul">');
    expect(result).toContain('<li class="md-li">item one</li>');
    expect(result).toContain('<li class="md-li">item two</li>');
  });

  it('renders ordered lists', () => {
    const input = '1. first\n2. second';
    const result = linkify(escapeMessage(input));
    expect(result).toContain('<ol class="md-ol">');
    expect(result).toContain('first');
  });

  it('renders horizontal rule', () => {
    expect(linkify(escapeMessage('---'))).toContain('<hr class="md-hr"/>');
    expect(linkify(escapeMessage('***'))).toContain('<hr class="md-hr"/>');
  });

  it('renders blockquotes', () => {
    expect(linkify(escapeMessage('> quoted text'))).toContain('<blockquote class="md-quote">quoted text</blockquote>');
  });

  it('renders @mentions as pills', () => {
    expect(linkify(escapeMessage('hey @alice check this'))).toContain('<span class="mention-pill">@alice</span>');
  });

  it('renders @channel and @here as special mentions', () => {
    expect(linkify(escapeMessage('@channel'))).toContain('mention-special');
    expect(linkify(escapeMessage('@here'))).toContain('mention-special');
  });

  it('escapes HTML to prevent XSS', () => {
    const result = linkify(escapeMessage('<script>alert("xss")</script>'));
    expect(result).not.toContain('<script>');
    expect(result).toContain('&lt;script&gt;');
  });
});
