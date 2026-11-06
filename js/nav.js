/*
    Desc: Shared by every page: the light/dark theme switch and the small-screen menu button.

    Author: Lynsay A. Shepherd

    Date: November 2026
*/

(function () {
    "use strict";

    //light / dark theme switch (the saved choice is applied before first paint by a script in each page's <head>)
    var themeBtn = document.getElementById("themeToggle");
    if (themeBtn) {
        var syncTheme = function () {
            themeBtn.setAttribute("aria-pressed", document.documentElement.getAttribute("data-theme") === "dark");
        };
        syncTheme();
        themeBtn.addEventListener("click", function () {
            var next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
            document.documentElement.setAttribute("data-theme", next);
            try { localStorage.setItem("theme", next); } catch (e) { /* storage unavailable: still works for this visit */ }
            syncTheme();
        });
    }

    //menu button (only visible on small screens; without JavaScript the links are simply always shown)
    var menuBtn = document.getElementById("navToggle");
    var menu = document.getElementById("navMenu");
    if (menuBtn && menu) {
        var setOpen = function (open) {
            menu.classList.toggle("open", open);
            menuBtn.setAttribute("aria-expanded", open);
        };
        menuBtn.addEventListener("click", function () {
            setOpen(menuBtn.getAttribute("aria-expanded") !== "true");
        });
        document.addEventListener("keydown", function (e) {
            if (e.key === "Escape" && menuBtn.getAttribute("aria-expanded") === "true") {
                setOpen(false);
                menuBtn.focus();
            }
        });
    }
})();
