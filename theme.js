// theme.js - Handles dark theme toggling across pages

document.addEventListener('DOMContentLoaded', () => {
    const themeToggles = document.querySelectorAll('#theme-toggle, .theme-toggle');
    const prefersDarkScheme = window.matchMedia("(prefers-color-scheme: dark)");

    // Check local storage for saved theme preference
    const currentTheme = localStorage.getItem("theme");

    if (currentTheme == "dark") {
        document.body.setAttribute("data-theme", "dark");
        updateToggleIcons(true);
    } else if (currentTheme == "light") {
        document.body.setAttribute("data-theme", "light");
        updateToggleIcons(false);
    } else if (prefersDarkScheme.matches) {
        document.body.setAttribute("data-theme", "dark");
        updateToggleIcons(true);
    }

    themeToggles.forEach(toggle => {
        toggle.addEventListener("click", function () {
            let theme = document.body.getAttribute("data-theme");
            if (theme == "dark") {
                document.body.removeAttribute("data-theme");
                localStorage.setItem("theme", "light");
                updateToggleIcons(false);
            } else {
                document.body.setAttribute("data-theme", "dark");
                localStorage.setItem("theme", "dark");
                updateToggleIcons(true);
            }
        });
    });

    function updateToggleIcons(isDark) {
        themeToggles.forEach(toggle => {
            const icon = toggle.querySelector('i');
            if (icon) {
                if (isDark) {
                    icon.classList.remove('ph-moon');
                    icon.classList.add('ph-sun');
                } else {
                    icon.classList.remove('ph-sun');
                    icon.classList.add('ph-moon');
                }
            }
        });
    }
});
