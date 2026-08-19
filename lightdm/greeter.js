/* The greeter's behaviour: everything that talks to LightDM, and nothing that
   decides how anything looks. The web-greeter API arrives asynchronously, so
   the whole theme is built from the GreeterReady event; loading _vendor/js/mock.js
   instead gives the same object in a browser, which is what preview-lightdm does.

   The password "justice" logs in under the mock. */

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const html = document.documentElement;
const entry = $("#entry");
const entryLabel = $("#entry-label");
const message = $("#message");
const userSelect = $("#user-select");
const sessionSelect = $("#session-select");
const languageSelect = $("#language-select");

const state = (name) => html.setAttribute("data-state", name);

/* ---------- clock ---------- */

/* Locale formatting only; the greeter runs before any session has said what the
   user prefers, so the system locale is the best available answer. */
function startClock() {
    const time = $("#clock-time");
    const date = $("#clock-date");
    const tick = () => {
        const now = new Date();
        time.textContent = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        date.textContent = now.toLocaleDateString([], {
            weekday: "long", day: "numeric", month: "long",
        });
    };
    tick();
    setInterval(tick, 1000);
}

/* ---------- colour scheme ---------- */

/* The system preference decides until the toggle is pressed; the choice then
   sticks for as long as the greeter's storage survives, which on a locked-down
   seat may be only this boot. */
function setupScheme() {
    const stored = (() => {
        try { return localStorage.getItem("halon-scheme"); } catch { return null; }
    })();
    if (stored === "light" || stored === "dark") html.setAttribute("data-scheme", stored);

    $("#scheme-toggle").addEventListener("click", () => {
        const dark = html.getAttribute("data-scheme") === "dark"
            || (!html.hasAttribute("data-scheme")
                && window.matchMedia("(prefers-color-scheme: dark)").matches);
        const next = dark ? "light" : "dark";
        html.setAttribute("data-scheme", next);
        try { localStorage.setItem("halon-scheme", next); } catch { /* not persisted */ }
    });
}

/* ---------- messages ---------- */

function showMessage(text, type) {
    if (!text) return clearMessage();
    message.hidden = false;
    message.textContent = String(text).replace(/:\s*$/, "");
    message.dataset.type = type === "error" || type === 1 || type === "1" ? "error" : "info";
}

function clearMessage() {
    message.hidden = true;
    message.textContent = "";
    delete message.dataset.type;
}

/* ---------- users and sessions ---------- */

const initials = (name) => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

function showUser(user) {
    const avatar = $("#avatar");
    $("#user-name").textContent = user ? user.display_name || user.username : "Log in";

    if (user && user.image) {
        avatar.style.backgroundImage = `url("${user.image}")`;
        avatar.textContent = "";
    } else {
        avatar.style.backgroundImage = "";
        avatar.textContent = user ? initials(user.display_name || user.username) : "";
    }

    /* A user's own session wins over the seat default, matching what LightDM
       would have started for them last time. */
    if (user && user.session) selectOption(sessionSelect, user.session);
    if (user && user.language) selectOption(languageSelect, user.language);
}

function selectOption(select, value) {
    if ([...select.options].some((o) => o.value === value)) select.value = value;
}

function fillSessions(lightdm) {
    for (const session of lightdm.sessions) {
        sessionSelect.add(new Option(session.name, session.key));
    }
    selectOption(sessionSelect, lightdm.default_session);
    /* One session is not a choice, so the footer would only be a bare hairline. */
    if (lightdm.sessions.length < 2) $(".card-footer").hidden = true;
}

/* The bare language subtag, since a corner control has no room for
   "English (United States)" and the value keeps the full code regardless. */
const languageLabel = (code) => code.split(/[_.@]/)[0].toUpperCase();

function fillLanguages(lightdm) {
    const languages = lightdm.languages || [];
    for (const language of languages) {
        languageSelect.add(new Option(languageLabel(language.code), language.code));
    }
    selectOption(languageSelect, (lightdm.language || {}).code);
    /* One language is not a choice, so the control would only be noise. */
    if (languages.length < 2) languageSelect.hidden = true;
}

function fillUsers(lightdm) {
    const users = lightdm.users || [];
    if (lightdm.hide_users_hint || users.length < 2) return;

    for (const user of users) {
        userSelect.add(new Option(user.display_name || user.username, user.username));
    }
    $("#user-field").hidden = false;

    userSelect.addEventListener("change", () => {
        const user = users.find((u) => u.username === userSelect.value);
        showUser(user);
        clearMessage();
        entry.value = "";
        restartAuthentication(lightdm, userSelect.value);
    });
}

/* ---------- power and battery ---------- */

function setupPower(lightdm) {
    const available = {
        suspend: lightdm.can_suspend,
        hibernate: lightdm.can_hibernate,
        restart: lightdm.can_restart,
        shutdown: lightdm.can_shutdown,
    };

    for (const button of $$("[data-power]")) {
        const action = button.dataset.power;
        if (!available[action]) continue;
        button.hidden = false;
        button.addEventListener("click", () => lightdm[action]());
    }
}

function setupBattery(lightdm) {
    if (!lightdm.can_access_battery) return;
    const bar = $("#battery");
    const level = $("#battery-level");
    const draw = () => {
        const battery = lightdm.batteryData;
        if (!battery) return;
        bar.hidden = false;
        level.textContent = `${battery.level}%${battery.ac_status ? "" : " · on battery"}`;
    };
    draw();
    lightdm.battery_update.connect(draw);
}

/* ---------- authentication ---------- */

function restartAuthentication(lightdm, username) {
    if (lightdm.in_authentication) lightdm.cancel_authentication();
    state("idle");
    lightdm.authenticate(username || null);
    entry.focus();
}

function setupAuthentication(lightdm) {
    lightdm.show_prompt.connect((text, type) => {
        state("idle");
        if (text) entryLabel.textContent = String(text).replace(/:\s*$/, "");
        /* type 0 is a visible prompt — a username or a token — and 1 a secret. */
        entry.type = type === 0 || type === "text" ? "text" : "password";
        entry.value = "";
        entry.focus();
    });

    lightdm.show_message.connect(showMessage);

    lightdm.authentication_complete.connect(() => {
        if (!lightdm.is_authenticated) {
            state("idle");
            showMessage("Authentication failed", "error");
            entry.value = "";
            restartAuthentication(lightdm, currentUser(lightdm));
            return;
        }

        /* LightDM only accepts a language once it has authenticated, so the
           choice is applied here rather than when the select changes. */
        if (languageSelect.value) lightdm.set_language(languageSelect.value);

        /* Fade the greeter out before handing the seat over, so the screen does
           not flash between the login card and the session's first frame. */
        state("starting");
        const session = sessionSelect.value || lightdm.default_session;
        const start = () => lightdm.start_session(session);
        $(".greeter").addEventListener("transitionend", start, { once: true });
        setTimeout(start, 600);
    });

    lightdm.autologin_timer_expired.connect(() => lightdm.authenticate(lightdm.autologin_user));

    $("#login-form").addEventListener("submit", (event) => {
        event.preventDefault();
        if (html.dataset.state === "busy") return;
        clearMessage();
        state("busy");
        lightdm.respond(entry.value);
    });
}

const currentUser = (lightdm) =>
    userSelect.value || lightdm.select_user_hint || (lightdm.users[0] && lightdm.users[0].username) || null;

/* ---------- start ---------- */

window.addEventListener("GreeterReady", () => {
    const lightdm = window.lightdm;

    $("#hostname").textContent = lightdm.hostname || "";

    fillSessions(lightdm);
    fillLanguages(lightdm);
    fillUsers(lightdm);
    setupPower(lightdm);
    setupBattery(lightdm);
    setupAuthentication(lightdm);

    const username = currentUser(lightdm);
    showUser((lightdm.users || []).find((u) => u.username === username));
    selectOption(userSelect, username);
    restartAuthentication(lightdm, username);
});

setupScheme();
startClock();
