/*
    Desc: Sets the light/dark theme before the page is first painted, so there is no flash of the wrong theme.
          Dark is the default; a choice made with the theme switch (saved by nav.js) takes priority.
          Loaded from the <head> of every page, without "defer" or "async", so it runs before the page is drawn.
          Also marks that JavaScript is available (the "js" class on <html>), which the menu styles rely on.
          The theme switch itself is in nav.js.

    Author: Lynsay A. Shepherd

    Date: November 2026
*/

(function () {
    "use strict";

    document.documentElement.className += " js";

    var theme = "dark";                                     //the default

    try {
        var saved = localStorage.getItem("theme");          //set by the theme switch in nav.js
        if (saved === "light" || saved === "dark") { theme = saved; }
    } catch (e) {
        /* storage unavailable: just use the default */
    }

    document.documentElement.setAttribute("data-theme", theme);
})();
