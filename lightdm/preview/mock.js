/* Development only — never installed. A stand-in for the greeter object that
   web-greeter injects, so the theme can be opened in an ordinary browser.
   Covers exactly the API surface greeter.js touches; web-greeter ships a fuller
   mock at _vendor/js/mock.js, which this theme also works against.

   The password is "justice", as upstream's mock uses. */

(() => {
    const signal = () => {
        const callbacks = [];
        return {
            connect: (fn) => callbacks.push(fn),
            emit: (...args) => callbacks.forEach((fn) => fn(...args)),
        };
    };

    const lightdm = {
        mock: true,
        hostname: "workstation",
        default_session: "cinnamon",
        hide_users_hint: false,
        select_user_hint: "",
        autologin_user: "",
        in_authentication: false,
        is_authenticated: false,

        can_suspend: true,
        can_hibernate: true,
        can_restart: true,
        can_shutdown: true,

        can_access_battery: true,
        batteryData: { level: 85, status: "Discharging", ac_status: 0 },

        sessions: [
            { key: "cinnamon", name: "Cinnamon", comment: "Cinnamon" },
            { key: "hyprland", name: "Hyprland", comment: "Hyprland" },
            { key: "gnome", name: "GNOME", comment: "GNOME" },
        ],

        users: [
            { username: "user", display_name: "Example User", session: "cinnamon", image: "" },
            { username: "guest", display_name: "Guest", session: "gnome", image: "" },
        ],

        show_prompt: signal(),
        show_message: signal(),
        authentication_complete: signal(),
        autologin_timer_expired: signal(),
        battery_update: signal(),

        authenticate(username) {
            this.in_authentication = true;
            this.authentication_user = username;
            setTimeout(() => this.show_prompt.emit("Password:", 1), 50);
        },

        cancel_authentication() {
            this.in_authentication = false;
        },

        respond(response) {
            setTimeout(() => {
                this.is_authenticated = response === "justice";
                this.authentication_complete.emit();
            }, 700);
        },

        start_session: (session) => console.log("start_session", session),
        suspend: () => console.log("suspend"),
        hibernate: () => console.log("hibernate"),
        restart: () => console.log("restart"),
        shutdown: () => console.log("shutdown"),
    };

    window.lightdm = lightdm;
    window.addEventListener("load", () => window.dispatchEvent(new Event("GreeterReady")));
})();
