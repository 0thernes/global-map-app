// Allow-list sanitiser for Markdown rendered with marked (briefings, docs inside the app). Removes active elements,
// event-handler and style attributes, and any URL attribute whose scheme is not http(s), mailto, an in-page anchor or a
// relative path to a bundled file. Unit-tested against XSS vectors in test/unit/hardening.test.mjs (jsdom).
export function safeHTML(html, doc = document) {
  const t = doc.createElement('template');
  t.innerHTML = html;
  t.content
    .querySelectorAll(
      'script,style,iframe,frame,frameset,object,embed,applet,portal,link,meta,form,input,button,textarea,select,base,svg,math,template,noscript',
    )
    .forEach((n) => n.remove());
  t.content.querySelectorAll('*').forEach((n) => {
    for (const a of [...n.attributes]) {
      const v = a.value.trim().toLowerCase();
      if (
        /^on/i.test(a.name) ||
        a.name === 'style' ||
        /^(srcset|ping|poster|background|dynsrc|lowsrc)$/i.test(a.name) ||
        (/^(href|src|xlink:href|action|formaction)$/i.test(a.name) &&
          !/^(https?:|mailto:|#|data\/|\.\/|[a-z0-9_-]+\.(png|jpe?g|svg|md)$)/.test(v))
      )
        n.removeAttribute(a.name);
    }
    if (n.tagName === 'A') {
      n.setAttribute('rel', 'noopener noreferrer');
      n.setAttribute('target', '_blank');
    }
  });
  return t.innerHTML;
}
