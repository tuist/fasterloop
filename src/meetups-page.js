import { escape, renderPage } from "./layout.js";
import { pastMeetups } from "./meetups.js";

const formatDate = (date) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

const renderTalk = (talk) => `
          <li>
            <div>
              <p class="talk-title">${escape(talk.title)}</p>
              <p class="talk-speaker">${escape(talk.speaker)}</p>
            </div>
            ${talk.recording
              ? `<a class="watch" href="${escape(talk.recording)}">Watch recording</a>`
              : `<span class="watch pending">Recording coming soon</span>`}
          </li>`;

const renderMeetup = (meetup) => `
      <article class="past">
        <h2>${escape(meetup.title)}</h2>
        <p class="past-meta">${formatDate(meetup.date)} · ${escape(meetup.city)}${meetup.venue ? `, hosted at ${escape(meetup.venue)}` : ""}</p>
        <ul class="talks">${meetup.talks.map(renderTalk).join("")}
        </ul>
      </article>`;

const emptyState = `
      <div class="empty">
        <p>The first Faster Loop is in Berlin in January 2027. Recordings of every talk will be published here after each meetup.</p>
        <p><a href="/">See the next meetup</a></p>
      </div>`;

export const renderMeetupsPage = () =>
  renderPage({
    title: "Past meetups and recordings",
    description: "Past Faster Loop meetups and recordings of their talks.",
    path: "/meetups",
    body: `    <section class="intro">
      <h1>Past meetups and recordings</h1>
    </section>
${pastMeetups.length ? pastMeetups.map(renderMeetup).join("") : emptyState}`,
  });
