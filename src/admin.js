// /admin lists submissions. Cloudflare Access sits in front of it and only lets in
// people who log in with a @tuist.dev email. The Worker checks Access's signed token
// again, so a misconfigured or missing Access policy can't expose the data.

import { createRemoteJWKSet, jwtVerify } from "jose";
import { escape, renderPage } from "./layout.js";
import { kinds } from "./submissions.js";

const ALLOWED_DOMAIN = "@tuist.dev";

let jwks;

export async function adminEmail(request, env) {
  if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) return null;
  const token = request.headers.get("cf-access-jwt-assertion");
  if (!token) return null;
  jwks ??= createRemoteJWKSet(new URL(`${env.ACCESS_TEAM_DOMAIN}/cdn-cgi/access/certs`));
  try {
    const { payload } = await jwtVerify(token, jwks, { issuer: env.ACCESS_TEAM_DOMAIN, audience: env.ACCESS_AUD });
    const email = String(payload.email ?? "").toLowerCase();
    return email.endsWith(ALLOWED_DOMAIN) ? email : null;
  } catch {
    return null;
  }
}

const renderTable = (kind, rows) => {
  const fields = kinds[kind].fields;
  if (!rows.length) return `<p>None yet.</p>`;
  return `
      <div class="table-scroll"><table class="admin-table">
        <thead><tr><th>Received</th><th>Via</th>${fields.map((f) => `<th>${escape(f.label)}</th>`).join("")}</tr></thead>
        <tbody>${rows
          .map(
            (row) =>
              `<tr><td>${escape(row.created_at)}</td><td>${escape(row.source)}</td>${fields
                .map((f) =>
                  f.type === "email"
                    ? `<td><a href="mailto:${escape(row[f.name])}">${escape(row[f.name])}</a></td>`
                    : `<td>${escape(row[f.name] ?? "")}</td>`,
                )
                .join("")}</tr>`,
          )
          .join("")}</tbody>
      </table></div>`;
};

export async function handleAdmin(request, env) {
  const email = await adminEmail(request, env);
  if (!email) {
    return new Response("Forbidden: sign in with a tuist.dev email through Cloudflare Access.", {
      status: 403,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const sections = [];
  for (const [kind, { table, noun }] of Object.entries(kinds)) {
    const { results } = await env.DB.prepare(
      `SELECT * FROM ${table} WHERE confirmed_at IS NOT NULL ORDER BY created_at DESC`,
    ).all();
    sections.push(`
    <section class="block">
      <h2>${escape(noun[0].toUpperCase() + noun.slice(1))}s (${results.length})</h2>${renderTable(kind, results)}
    </section>`);
  }

  const response = renderPage({
    title: "Submissions",
    path: "/admin",
    body: `    <section class="intro">
      <h1>Submissions</h1>
      <p>Confirmed talk proposals and venue offers. Signed in as ${escape(email)}.</p>
    </section>${sections.join("")}`,
  });
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("X-Robots-Tag", "noindex");
  return response;
}
