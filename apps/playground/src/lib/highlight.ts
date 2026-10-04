import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
import json from 'highlight.js/lib/languages/json';
import typescript from 'highlight.js/lib/languages/typescript';
import xml from 'highlight.js/lib/languages/xml';

hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('tsx', typescript);
hljs.registerLanguage('json', json);
hljs.registerLanguage('xml', xml);

/** HTML with highlight.js token classes. highlight.js escapes the code, so the result is safe to inject. */
export function highlight(code: string, language: string): string {
  return hljs.highlight(code, { language, ignoreIllegals: true }).value;
}
