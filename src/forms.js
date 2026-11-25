import { escape, renderPage } from "./layout.js";
import { CONFIRM_WITHIN_DAYS, confirm, findByToken, kinds, submit, validate } from "./submissions.js";

const pages = {
  "/speak": {
    kind: "talk",
    title: "Give a talk",
    intro:
      "If you've been trying new ways of building, whether it's working or not, we'd love to hear about it. First-time speakers are welcome, and we're happy to help you shape the talk.",
    submit: "Send talk idea",
    thanks: "your talk idea",
  },
  "/host": {
    kind: "venue",
    title: "Host a meetup",
    intro:
      "We start in Berlin and want to take Faster Loop to other cities. If your company has a room for 60 to 80 people, your team gets the main talk and we take care of the rest.",
    submit: "Offer your venue",
    thanks: "your venue offer",
  },
};

export const isFormPath = (path) => path in pages;

const renderField = (field) => {
  const attrs = [
    `id="${field.name}"`,
    `name="${field.name}"`,
    field.required ? "required" : "",
    field.type === "number" ? `min="${field.min}" max="${field.max}"` : `maxlength="${field.max}"`,
    field.placeholder ? `placeholder="${escape(field.placeholder)}"` : "",
  ].filter(Boolean).join(" ");
  const control = field.multiline
    ? `<textarea ${attrs} rows="6"></textarea>`
    : `<input type="${field.type ?? "text"}" ${attrs}>`;
  return `
        <label for="${field.name}">${escape(field.label)}${field.required ? "" : ' <span class="optional">optional</span>'}</label>
        ${field.description ? `<p class="hint">${escape(field.description)}</p>` : ""}
        ${control}`;
};

const mcpNote = `
      <aside class="agent-note" id="agent">
        <h2>Or ask your agent</h2>
        <p>Faster Loop has an MCP server. Add it to your coding agent and ask it to propose a talk or offer a venue for you:</p>
        <pre><code>https://fasterloop.org/mcp</code></pre>
      </aside>`;

export async function handleForm(request, env, path) {
  const page = pages[path];

  if (request.method === "POST") {
    const form = Object.fromEntries(await request.formData());
    // Bots fill in every field, including this one that people never see.
    if (!form.website) {
      const result = validate(page.kind, form);
      if (result.errors) {
        return renderPage({
          title: page.title,
          path,
          status: 400,
          body: `    <section class="intro">
      <h1>Almost there</h1>
      <ul class="errors">${result.errors.map((error) => `<li>${escape(error)}</li>`).join("")}</ul>
      <p>Go back and fix ${result.errors.length === 1 ? "this" : "these"}, then send it again.</p>
    </section>`,
        });
      }
      const outcome = await submit(env, page.kind, result.data, "web", new URL(request.url).origin);
      if (outcome.error) {
        return renderPage({
          title: page.title,
          path,
          status: 429,
          body: `    <section class="intro">
      <h1>That didn't go through</h1>
      <p>${escape(outcome.error)}</p>
    </section>`,
        });
      }
    }
    return renderPage({
      title: page.title,
      path,
      body: `    <section class="intro">
      <h1>Check your email</h1>
      <p>We sent you a link to confirm ${escape(page.thanks)}. It counts once you open it, within ${CONFIRM_WITHIN_DAYS} days.</p>
      <p><a href="/">Back to Faster Loop</a></p>
    </section>`,
    });
  }

  return renderPage({
    title: page.title,
    description: page.intro,
    path,
    body: `    <section class="intro">
      <h1>${escape(page.title)}</h1>
      <p>${escape(page.intro)}</p>
    </section>
    <section class="block form-layout">
      <form method="post" action="${path}" class="form">${kinds[page.kind].fields.map(renderField).join("")}
        <div class="hp" aria-hidden="true"><label for="website">Leave this empty</label><input id="website" name="website" tabindex="-1" autocomplete="off"></div>
        <button class="rsvp" type="submit">${escape(page.submit)}</button>
      </form>${mcpNote}
    </section>`,
  });
}

// GET shows a button instead of confirming right away, because mail scanners open links in emails.
export async function handleConfirm(request, env) {
  const token = request.method === "POST" ? (await request.formData()).get("token") : new URL(request.url).searchParams.get("token");
  const submission = await findByToken(env, token);
  if (!submission) {
    return renderPage({
      title: "Link expired",
      path: "/confirm",
      status: 404,
      body: `    <section class="intro">
      <h1>This link doesn't work anymore</h1>
      <p>It may have expired after ${CONFIRM_WITHIN_DAYS} days. You can <a href="/speak">send a talk idea</a> or <a href="/host">offer a venue</a> again.</p>
    </section>`,
    });
  }
  const noun = kinds[submission.kind].noun;
  if (request.method === "POST" || submission.confirmed_at) {
    await confirm(env, submission);
    return renderPage({
      title: "Confirmed",
      path: "/confirm",
      body: `    <section class="intro">
      <h1>Confirmed, thanks!</h1>
      <p>Your ${escape(noun)} is with the organizers. We'll get back to you by email.</p>
      <p><a href="/">Back to Faster Loop</a></p>
    </section>`,
    });
  }
  return renderPage({
    title: "Confirm",
    path: "/confirm",
    body: `    <section class="intro">
      <h1>Confirm your ${escape(noun)}</h1>
      <form method="post" action="/confirm" class="form">
        <input type="hidden" name="token" value="${escape(token)}">
        <button class="rsvp" type="submit">Confirm</button>
      </form>
    </section>`,
  });
}
