export const escape = (value) =>
  String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const NAV = [
  ["/", "Next meetup"],
  ["/meetups", "Past meetups"],
];

// Wraps a page body in the site's header and footer. `title` is plain text.
export const renderPage = ({ title, description, path, body, status = 200 }) =>
  new Response(
    `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escape(title)} · Faster Loop</title>
  ${description ? `<meta name="description" content="${escape(description)}">` : ""}
  <link rel="canonical" href="https://fasterloop.org${path}">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <meta property="og:title" content="${escape(title)} · Faster Loop">
  <meta property="og:image" content="https://fasterloop.org/og.png">
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  <header class="top">
    <a class="wordmark" href="/">Faster Loop</a>
    <nav class="top-meta">${NAV.map(([href, label]) => `<a href="${href}"${href === path ? ' aria-current="page"' : ""}>${label}</a>`).join(" · ")} · hosted by <a href="https://tuist.dev">Tuist</a></nav>
  </header>

  <main>
${body}
  </main>

  <footer class="foot">
    <p>Faster Loop is hosted by <a href="https://tuist.dev">Tuist</a> and open to everyone, whatever tools you use.</p>
    <p><a href="mailto:hello@fasterloop.org">hello@fasterloop.org</a></p>
  </footer>
</body>
</html>
`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
