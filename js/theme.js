/*
    Desc: Sets the light/dark theme before the page is first painted, so there is no flash of the wrong theme.
          Loaded from the <head> of every page, without "defer" or "async", so it runs before the page is drawn.
          Also marks that JavaScript is available (the "js" class on <html>), which the menu styles rely on.
          The theme switch itself is in nav.js.

    Author: Lynsay A. Shepherd

    Date: November 2026
*/

(function () {
    "use strict";

    document.documentElement.className += " js";

    try {
        var theme = localStorage.getItem("theme");
        if (!theme) {
            theme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
        }
        document.documentElement.setAttribute("data-theme", theme);
    } catch (e) {
        /* storage unavailable: the stylesheet's default (light) theme is used */
    }
})();
