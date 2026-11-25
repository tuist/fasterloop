// Talk proposals and venue offers. The web forms, their validation and the MCP tools
// are all generated from these definitions, so a field only needs to be added here
// (and to the table in migrations/).

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const kinds = {
  talk: {
    table: "talk_proposals",
    noun: "talk proposal",
    tool: "propose_talk",
    toolDescription:
      "Propose a talk for a Faster Loop meetup. Faster Loop explores what building software looks like when code is cheap: agents write much of the code, teams produce more of it than ever, and the hard parts move to deciding what to build, trusting what gets merged, keeping builds and CI fast, and organizing teams. Good talks share what a team actually tried, including what didn't work. Ask the speaker to confirm the details before submitting.",
    fields: [
      { name: "name", label: "Your name", max: 200, required: true },
      { name: "email", label: "Email", type: "email", max: 320, required: true, description: "Where the organizers can reach the speaker." },
      { name: "company", label: "Company and role", max: 200 },
      { name: "title", label: "Talk title", max: 200, required: true },
      { name: "abstract", label: "What will you share?", multiline: true, max: 5000, required: true, description: "What you tried, what happened, and what others can take from it." },
      { name: "city", label: "City", max: 100, placeholder: "Berlin", description: "Which city's meetup the talk is for." },
    ],
  },
  venue: {
    table: "venue_offers",
    noun: "venue offer",
    tool: "offer_venue",
    toolDescription:
      "Offer to host a Faster Loop meetup at your company's office. A meetup is an evening for 60 to 80 people with two talks, a lightning talk and food; the host's team gets the main talk and the organizers handle the rest. Ask the person to confirm the details before submitting.",
    fields: [
      { name: "name", label: "Your name", max: 200, required: true },
      { name: "email", label: "Email", type: "email", max: 320, required: true },
      { name: "company", label: "Company", max: 200, required: true },
      { name: "city", label: "City", max: 100, required: true },
      { name: "capacity", label: "How many people fit?", type: "number", min: 1, max: 10000 },
      { name: "notes", label: "Anything else we should know?", multiline: true, max: 5000 },
    ],
  },
};

// Returns { data } with cleaned values, or { errors } with one message per bad field.
export function validate(kind, input) {
  const data = {};
  const errors = [];
  for (const field of kinds[kind].fields) {
    const raw = input[field.name];
    const value = raw == null ? "" : String(raw).trim();
    if (!value) {
      if (field.required) errors.push(`“${field.label}” is required.`);
      data[field.name] = null;
      continue;
    }
    if (field.type === "number") {
      const number = Number(value);
      if (!Number.isInteger(number) || number < field.min || number > field.max) {
        errors.push(`“${field.label}” must be a whole number between ${field.min} and ${field.max}.`);
      }
      data[field.name] = number;
      continue;
    }
    if (value.length > field.max) errors.push(`“${field.label}” must be at most ${field.max} characters.`);
    if (field.type === "email" && !EMAIL.test(value)) errors.push(`“${field.label}” must be an email address.`);
    data[field.name] = value;
  }
  return errors.length ? { errors } : { data };
}

const SENDER = { email: "hello@fasterloop.org", name: "Faster Loop" };
const MAX_PER_EMAIL_PER_HOUR = 3;
export const CONFIRM_WITHIN_DAYS = 7;

const sha256 = async (text) =>
  [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)))]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

// Stores a submission as unconfirmed and emails its submitter a confirmation link.
// Returns { ok: true } or { error } with a message for the submitter.
export async function submit(env, kind, data, source, origin) {
  const { table, noun } = kinds[kind];

  // Confirmation emails go to whatever address is typed in, so cap how many one address gets.
  const recent = await env.DB.prepare(
    `SELECT COUNT(*) AS count FROM ${table} WHERE lower(email) = lower(?) AND created_at > datetime('now', '-1 hour')`,
  )
    .bind(data.email)
    .first();
  if (recent.count >= MAX_PER_EMAIL_PER_HOUR) {
    return { error: "There have been too many submissions for this email address. Try again in an hour." };
  }

  const token = [...crypto.getRandomValues(new Uint8Array(32))].map((b) => b.toString(16).padStart(2, "0")).join("");
  const columns = [...Object.keys(data), "source", "confirm_token_hash"];
  const values = [...Object.values(data), source, await sha256(token)];
  const { meta } = await env.DB.prepare(
    `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`,
  )
    .bind(...values)
    .run();

  const link = `${origin}/confirm?token=${token}`;
  try {
    await env.EMAIL.send({
      from: SENDER,
      to: data.email,
      replyTo: SENDER.email,
      subject: `Confirm your Faster Loop ${noun}`,
      text: `Hi ${data.name},

Thanks for your Faster Loop ${noun}. Confirm it by opening this link within ${CONFIRM_WITHIN_DAYS} days:

${link}

If you didn't send this, ignore this email and nothing will happen.

Faster Loop, hosted by Tuist
https://fasterloop.org`,
    });
  } catch (error) {
    console.error("Sending the confirmation email failed", error);
    await env.DB.prepare(`DELETE FROM ${table} WHERE id = ?`).bind(meta.last_row_id).run();
    return { error: "We couldn't send the confirmation email. Check the address and try again." };
  }
  return { ok: true };
}

// Finds the unconfirmed, unexpired submission an emailed token belongs to.
export async function findByToken(env, token) {
  if (!/^[0-9a-f]{64}$/.test(token ?? "")) return null;
  const hash = await sha256(token);
  for (const [kind, { table }] of Object.entries(kinds)) {
    const row = await env.DB.prepare(
      `SELECT id, confirmed_at FROM ${table} WHERE confirm_token_hash = ? AND created_at > datetime('now', '-${CONFIRM_WITHIN_DAYS} days')`,
    )
      .bind(hash)
      .first();
    if (row) return { kind, ...row };
  }
  return null;
}

export async function confirm(env, submission) {
  await env.DB.prepare(`UPDATE ${kinds[submission.kind].table} SET confirmed_at = datetime('now') WHERE id = ? AND confirmed_at IS NULL`)
    .bind(submission.id)
    .run();
}

export function inputSchema(kind) {
  const { fields } = kinds[kind];
  return {
    type: "object",
    properties: Object.fromEntries(
      fields.map((field) => [
        field.name,
        field.type === "number"
          ? { type: "integer", minimum: field.min, maximum: field.max, description: field.description ?? field.label }
          : { type: "string", maxLength: field.max, description: field.description ?? field.label },
      ]),
    ),
    required: fields.filter((field) => field.required).map((field) => field.name),
    additionalProperties: false,
  };
}
