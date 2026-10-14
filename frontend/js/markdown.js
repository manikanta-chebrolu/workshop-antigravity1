/**
 * Nexus AI - Markdown & Code Highlighting Engine
 * Safe, fast parsing of Markdown with syntax highlighting and copy controls
 */

const MarkdownParser = {
  // Simple HTML sanitizer
  escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  },

  // Syntax highlighter for popular languages (JS, Python, HTML, CSS, SQL, JSON, Bash)
  highlightCode(code, lang) {
    let safe = this.escapeHtml(code);
    lang = (lang || '').toLowerCase();

    if (lang === 'js' || lang === 'javascript' || lang === 'typescript' || lang === 'ts') {
      safe = safe
        .replace(/\b(const|let|var|function|return|if|else|for|while|import|export|from|async|await|try|catch|class|extends|new|this)\b/g, '<span style="color:#f43f5e;font-weight:600;">$1</span>')
        .replace(/\b(true|false|null|undefined)\b/g, '<span style="color:#fb923c;">$1</span>')
        .replace(/(&quot;.*?&quot;|&#039;.*?&#039;|`.*?`)/g, '<span style="color:#10b981;">$1</span>')
        .replace(/(\/\/.*$)/gm, '<span style="color:#64748b;font-style:italic;">$1</span>')
        .replace(/\b([a-zA-Z_$][a-zA-Z0-9_$]*)(?=\()/g, '<span style="color:#38bdf8;">$1</span>');
    } else if (lang === 'python' || lang === 'py') {
      safe = safe
        .replace(/\b(def|return|if|elif|else|for|while|import|from|class|try|except|with|as|lambda|pass|break|continue)\b/g, '<span style="color:#f43f5e;font-weight:600;">$1</span>')
        .replace(/\b(True|False|None)\b/g, '<span style="color:#fb923c;">$1</span>')
        .replace(/(&quot;.*?&quot;|&#039;.*?&#039;)/g, '<span style="color:#10b981;">$1</span>')
        .replace(/(#.*$)/gm, '<span style="color:#64748b;font-style:italic;">$1</span>')
        .replace(/\b([a-zA-Z_][a-zA-Z0-9_]*)(?=\()/g, '<span style="color:#38bdf8;">$1</span>');
    } else if (lang === 'html' || lang === 'xml') {
      safe = safe
        .replace(/(&lt;\/?)([a-zA-Z0-9\-]+)(.*?)(&gt;)/g, (match, p1, p2, p3, p4) => {
          let attrs = p3.replace(/([a-zA-Z\-:]+)=(&quot;.*?&quot;|&#039;.*?&#039;)/g, '<span style="color:#fb923c;">$1</span>=<span style="color:#10b981;">$2</span>');
          return `${p1}<span style="color:#f43f5e;font-weight:600;">${p2}</span>${attrs}${p4}`;
        });
    } else if (lang === 'sql') {
      safe = safe
        .replace(/\b(SELECT|FROM|WHERE|INSERT|INTO|UPDATE|DELETE|JOIN|LEFT|RIGHT|INNER|OUTER|ON|GROUP BY|ORDER BY|HAVING|LIMIT|CREATE|TABLE|ALTER|DROP|AS|AND|OR|NOT|IN|VALUES)\b/gi, '<span style="color:#f43f5e;font-weight:600;">$1</span>')
        .replace(/(&quot;.*?&quot;|&#039;.*?&#039;)/g, '<span style="color:#10b981;">$1</span>')
        .replace(/(--.*$)/gm, '<span style="color:#64748b;font-style:italic;">$1</span>');
    }

    return safe;
  },

  // Main markdown parser
  parse(markdown) {
    if (!markdown) return '';

    // 1. Extract and protect code blocks
    const codeBlocks = [];
    let parsed = markdown.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (match, lang, code) => {
      const id = `__CODE_BLOCK_${codeBlocks.length}__`;
      const highlighted = this.highlightCode(code.trim(), lang);
      const displayLang = lang || 'code';

      const blockHtml = `
        <div class="code-block-container" data-lang="${this.escapeHtml(displayLang)}">
          <div class="code-block-header">
            <span class="code-lang-tag">${this.escapeHtml(displayLang)}</span>
            <button class="code-copy-btn" onclick="NexusApp.copyCode(this)">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
              <span>Copy</span>
            </button>
          </div>
          <pre><code>${highlighted}</code></pre>
          <textarea style="display:none;" class="raw-code">${this.escapeHtml(code.trim())}</textarea>
        </div>
      `;
      codeBlocks.push(blockHtml);
      return id;
    });

    // 2. Headings
    parsed = parsed
      .replace(/^#### (.*$)/gim, '<h4>$1</h4>')
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^# (.*$)/gim, '<h1>$1</h1>');

    // 3. Blockquotes
    parsed = parsed.replace(/^\> (.*$)/gim, '<blockquote>$1</blockquote>');

    // 4. Horizontal Rules
    parsed = parsed.replace(/^---$/gim, '<hr style="border:none;border-top:1px solid var(--border-medium);margin:16px 0;">');

    // 5. Bold & Italics
    parsed = parsed
      .replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/___(.*?)___/g, '<strong><em>$1</em></strong>')
      .replace(/__(.*?)__/g, '<strong>$1</strong>')
      .replace(/_(.*?)_/g, '<em>$1</em>');

    // 6. Inline Code
    parsed = parsed.replace(/`([^`]+)`/g, (match, code) => {
      return `<code>${this.escapeHtml(code)}</code>`;
    });

    // 7. Markdown Tables
    parsed = parsed.replace(/((?:\|[^\n]+\|\n?)+)/g, (tableMatch) => {
      const lines = tableMatch.trim().split('\n').filter(l => l.trim().length > 0);
      if (lines.length < 2) return tableMatch;

      let html = '<div class="markdown-table-wrapper"><table>';
      lines.forEach((line, idx) => {
        // Skip separator row like |---|---|
        if (line.match(/^\|?\s*:?-+:?\s*\|/)) return;

        const cells = line.split('|').filter((_, i, arr) => i > 0 && i < arr.length - 1);
        if (cells.length === 0) return;

        const tag = (idx === 0) ? 'th' : 'td';
        html += '<tr>';
        cells.forEach(cell => {
          html += `<${tag}>${cell.trim()}</${tag}>`;
        });
        html += '</tr>';
      });
      html += '</table></div>';
      return html;
    });

    // 8. Lists (Unordered & Ordered)
    parsed = parsed.replace(/(?:^|\n)([-*]\s.*(?:\n[-*]\s.*)*)/g, (match, list) => {
      const items = list.trim().split('\n').map(li => {
        return `<li>${li.replace(/^[-*]\s+/, '').trim()}</li>`;
      }).join('');
      return `<ul>${items}</ul>`;
    });

    parsed = parsed.replace(/(?:^|\n)(\d+\.\s.*(?:\n\d+\.\s.*)*)/g, (match, list) => {
      const items = list.trim().split('\n').map(li => {
        return `<li>${li.replace(/^\d+\.\s+/, '').trim()}</li>`;
      }).join('');
      return `<ol>${items}</ol>`;
    });

    // 9. Links
    parsed = parsed.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" style="color:var(--accent-cyan);text-decoration:underline;">$1</a>');

    // 10. Paragraphs (split by double newlines, ignoring block tags)
    const blocks = parsed.split(/\n{2,}/);
    const htmlBlocks = blocks.map(b => {
      b = b.trim();
      if (!b) return '';
      if (b.startsWith('__CODE_BLOCK_') ||
          b.startsWith('<h') ||
          b.startsWith('<ul') ||
          b.startsWith('<ol') ||
          b.startsWith('<blockquote') ||
          b.startsWith('<div class="markdown-table-wrapper') ||
          b.startsWith('<hr')) {
        return b;
      }
      return `<p>${b.replace(/\n/g, '<br>')}</p>`;
    });

    parsed = htmlBlocks.join('\n');

    // 11. Restore Code Blocks
    codeBlocks.forEach((block, idx) => {
      parsed = parsed.replace(`__CODE_BLOCK_${idx}__`, block);
    });

    return parsed;
  }
};

window.MarkdownParser = MarkdownParser;
