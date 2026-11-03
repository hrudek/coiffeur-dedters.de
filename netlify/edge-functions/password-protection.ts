/**
 * Einfacher Passwortschutz für die gesamte Seite (Vorschau-Phase).
 *
 * Funktioniert auch im kostenlosen Netlify-Tarif. Das Passwort steht in der
 * Netlify-Umgebungsvariable SITE_PASSWORD (Site configuration → Environment variables).
 *
 * - Variable gesetzt   → Besucher müssen einmal das Passwort eingeben (Cookie gilt 30 Tage).
 * - Variable gelöscht  → Seite ist öffentlich (nach dem nächsten Deploy).
 *
 * Wenn die Seite dauerhaft öffentlich ist, kann diese Datei gelöscht werden.
 */
import type { Config, Context } from "@netlify/edge-functions";

const COOKIE_NAME = "site_access";
const LOGIN_PATH = "/__login";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 Tage

async function hash(value: string): Promise<string> {
  const data = new TextEncoder().encode(`coiffeur-dedters:${value}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

function safeRedirectTarget(value: FormDataEntryValue | null): string {
  const target = typeof value === "string" ? value : "/";
  // Nur interne Pfade zulassen (kein Open Redirect)
  return target.startsWith("/") && !target.startsWith("//") ? target : "/";
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function loginPage(redirectTo: string, error: boolean): Response {
  const html = `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex, nofollow" />
  <title>Coiffeur Dedters – Vorschau</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body {
      margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 1.5rem;
      background: #111111; color: #ffffff;
      font-family: "Lato", ui-sans-serif, system-ui, sans-serif;
    }
    main { width: 100%; max-width: 22rem; text-align: center; }
    h1 {
      font-family: "Cinzel", ui-serif, Georgia, serif; font-weight: 500;
      letter-spacing: 0.15em; text-transform: uppercase; font-size: 1.5rem; margin: 0 0 0.5rem;
    }
    p { color: #a1a1aa; font-size: 0.95rem; line-height: 1.5; margin: 0 0 2rem; }
    .line { width: 3rem; height: 1px; background: #b8a07e; margin: 1rem auto 1.5rem; }
    input {
      width: 100%; padding: 0.85rem 1rem; font-size: 1rem; color: #ffffff;
      background: transparent; border: 1px solid #3f3f46; border-radius: 0; outline: none;
    }
    input:focus { border-color: #b8a07e; }
    button {
      width: 100%; margin-top: 1rem; padding: 0.85rem 1rem; font-size: 0.8rem; cursor: pointer;
      letter-spacing: 0.2em; text-transform: uppercase; border: 0; border-radius: 0;
      background: #b8a07e; color: #111111; font-weight: 700;
    }
    button:hover { background: #d9c8ad; }
    .error { color: #f87171; font-size: 0.9rem; margin: 1rem 0 0; }
  </style>
</head>
<body>
  <main>
    <h1>Coiffeur Dedters</h1>
    <div class="line"></div>
    <p>Diese Seite ist noch in Vorbereitung.<br />Bitte gib das Passwort ein.</p>
    <form method="post" action="${LOGIN_PATH}">
      <input type="hidden" name="redirect" value="${escapeHtml(redirectTo)}" />
      <label for="password" style="position:absolute;left:-9999px">Passwort</label>
      <input id="password" type="password" name="password" placeholder="Passwort" autocomplete="current-password" autofocus required />
      <button type="submit">Weiter</button>
      ${error ? '<p class="error">Das Passwort ist leider falsch.</p>' : ""}
    </form>
  </main>
</body>
</html>`;

  return new Response(html, {
    status: 401,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "x-robots-tag": "noindex, nofollow",
    },
  });
}

export default async (request: Request, context: Context) => {
  const password = Netlify.env.get("SITE_PASSWORD");
  if (!password) return context.next(); // Schutz deaktiviert

  const expected = await hash(password);
  const url = new URL(request.url);

  // Formular abgeschickt
  if (url.pathname === LOGIN_PATH && request.method === "POST") {
    const form = await request.formData();
    const redirectTo = safeRedirectTarget(form.get("redirect"));

    if (form.get("password") === password) {
      return new Response(null, {
        status: 303,
        headers: {
          location: redirectTo,
          "set-cookie": `${COOKIE_NAME}=${expected}; Path=/; Max-Age=${MAX_AGE}; HttpOnly; Secure; SameSite=Lax`,
          "cache-control": "no-store",
        },
      });
    }
    return loginPage(redirectTo, true);
  }

  // Bereits angemeldet → Seite normal ausliefern
  if (context.cookies.get(COOKIE_NAME) === expected) {
    const response = await context.next();
    response.headers.set("x-robots-tag", "noindex, nofollow");
    return response;
  }

  return loginPage(url.pathname + url.search, false);
};

export const config: Config = {
  path: "/*",
};
