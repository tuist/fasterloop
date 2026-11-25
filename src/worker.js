import { handleAdmin } from "./admin.js";
import { handleConfirm, handleForm, isFormPath } from "./forms.js";
import { handleMcp } from "./mcp.js";
import { renderMeetupsPage } from "./meetups-page.js";

const SECURITY_HEADERS = {
  "Content-Security-Policy":
    "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Content-Type-Options": "nosniff",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};

async function route(request, env, url) {
  const path = url.pathname.replace(/(.)\/$/, "$1");
  if (path === "/mcp") return handleMcp(request, env);
  if (path === "/meetups") return renderMeetupsPage();
  if (path === "/confirm") return handleConfirm(request, env);
  if (path === "/admin") return handleAdmin(request, env);
  if (isFormPath(path)) return handleForm(request, env, path);
  return env.ASSETS.fetch(request);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.hostname === "www.fasterloop.org") {
      url.hostname = "fasterloop.org";
      return Response.redirect(url.toString(), 301);
    }

    const response = await route(request, env, url);
    const headers = new Headers(response.headers);
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
      headers.set(name, value);
    }
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
};
