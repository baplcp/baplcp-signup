(function () {
  var DRAWER_HTML = [
    '<div class="menu-overlay" id="menu-overlay" aria-hidden="true" inert>',
    '  <button class="menu-backdrop" type="button" data-menu-close aria-label="關閉選單"></button>',
    '  <aside class="side-menu" role="dialog" aria-modal="true" aria-labelledby="drawer-user-name">',
    '    <div class="drawer-profile">',
    '      <img class="drawer-avatar" src="./images/cookie.png" alt="">',
    '      <div class="drawer-user-stack">',
    '        <p class="drawer-user" id="drawer-user-name">吳佳穎</p>',
    '        <span class="drawer-role"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4.5 19H19.5V21H4.5V19Z" fill="currentColor"/><path d="M5.5 17L4 7.5L8.5 11L12 5L15.5 11L20 7.5L18.5 17H5.5Z" fill="currentColor"/></svg><span>偉大的主揪</span></span>',
    '      </div>',
    '      <button class="drawer-close" type="button" data-menu-close aria-label="關閉選單">',
    '        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" aria-hidden="true">',
    '          <path d="M7 7L17 17M17 7L7 17" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
    '        </svg>',
    '      </button>',
    '    </div>',
    '    <div class="drawer-content">',
    '      <section class="drawer-section" aria-labelledby="drawer-common-title">',
    '        <h2 class="drawer-section-title" id="drawer-common-title">常用功能</h2>',
    '        <nav class="drawer-list" aria-label="常用功能">',
    '          <a class="drawer-link" href="./signup.html"><span class="drawer-icon"><img src="./images/ball.png" alt=""></span><span>季打報名</span></a>',
    '          <a class="drawer-link" href="./active-activity.html"><span class="drawer-icon"><img src="./images/icon-album.png" alt=""></span><span>參與紀錄</span></a>',
    '          <a class="drawer-link" href="./group-list.html"><span class="drawer-icon"><img src="./images/Registration list.png" alt=""></span><span>開團列表</span></a>',
    '          <a class="drawer-link" href="https://store.line.me/stickershop/product/30532466/" target="_blank" rel="noreferrer"><span class="drawer-icon is-warm"><img src="./images/icon-donate.png" alt=""></span><span>贊助胖貓貓</span></a>',
    '        </nav>',
    '      </section>',
    '      <div class="drawer-divider" aria-hidden="true"></div>',
    '      <section class="drawer-section" aria-labelledby="drawer-admin-title">',
    '        <h2 class="drawer-section-title" id="drawer-admin-title">管理功能</h2>',
    '        <nav class="drawer-list" aria-label="管理功能">',
    '          <a class="drawer-link" href="#"><span class="drawer-icon is-muted"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden="true"><path d="M7 3.5V6M17 3.5V6M5 9H19M7 5H17C18.1 5 19 5.9 19 7V18C19 19.1 18.1 20 17 20H7C5.9 20 5 19.1 5 18V7C5 5.9 5.9 5 7 5Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M12 12V17M9.5 14.5H14.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></span><span>建立活動</span></a>',
    '          <a class="drawer-link" href="#"><span class="drawer-icon is-muted"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden="true"><path d="M6 5.5H18C19.1 5.5 20 6.4 20 7.5V18.5C20 19.6 19.1 20.5 18 20.5H6C4.9 20.5 4 19.6 4 18.5V7.5C4 6.4 4.9 5.5 6 5.5Z" fill="currentColor" opacity="0.2"/><path d="M8 3.5V7M16 3.5V7M4 9.5H20" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M8 13H16M8 16.5H13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></span><span>每週報名名單管理</span></a>',
    '          <a class="drawer-link" href="#"><span class="drawer-icon is-muted"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden="true"><path d="M12 12C14.21 12 16 10.21 16 8C16 5.79 14.21 4 12 4C9.79 4 8 5.79 8 8C8 10.21 9.79 12 12 12Z" fill="currentColor"/><path d="M5 20C5 16.69 8.13 14 12 14C15.87 14 19 16.69 19 20V20.5H5V20Z" fill="currentColor"/></svg></span><span>季打管理</span></a>',
    '          <a class="drawer-link" href="#"><span class="drawer-icon is-muted"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden="true"><path d="M8.5 11.5C10.43 11.5 12 9.93 12 8C12 6.07 10.43 4.5 8.5 4.5C6.57 4.5 5 6.07 5 8C5 9.93 6.57 11.5 8.5 11.5Z" fill="currentColor"/><path d="M16 11C17.66 11 19 9.66 19 8C19 6.34 17.66 5 16 5C14.34 5 13 6.34 13 8C13 9.66 14.34 11 16 11Z" fill="currentColor" opacity="0.78"/><path d="M3.5 20C3.5 16.96 5.97 14.5 9 14.5C10.62 14.5 12.08 15.2 13.09 16.32C12.7 17.04 12.5 17.86 12.5 18.72V20H3.5Z" fill="currentColor"/><path d="M13.5 20V18.72C13.5 17.78 13.19 16.9 12.67 16.19C13.48 15.45 14.55 15 15.72 15C18.24 15 20.28 17.04 20.28 19.56V20H13.5Z" fill="currentColor" opacity="0.78"/></svg></span><span>群內會員管理</span></a>',
    '          <a class="drawer-link" href="#"><span class="drawer-icon is-muted"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden="true"><path d="M12 4L18 7.4V14.6L12 20L6 14.6V7.4L12 4Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M12 10.5V13.5M10.5 12H13.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></span><span>管理員名單</span></a>',
    '        </nav>',
    '      </section>',
    '    </div>',
    '  </aside>',
    '</div>'
  ].join("");

  function initSideMenu() {
    var shell = document.querySelector(".phone-shell") || document.querySelector(".app-shell");
    var openButton = document.querySelector('.menu-btn, .icon-button[aria-label="開啟選單"]');

    if (!shell || !openButton) return;

    var overlay = document.getElementById("menu-overlay");
    if (!overlay) {
      shell.insertAdjacentHTML("beforeend", DRAWER_HTML);
      overlay = document.getElementById("menu-overlay");
    }

    var closeTargets = overlay.querySelectorAll("[data-menu-close]");

    function setMenuOpen(isOpen) {
      shell.classList.toggle("menu-open", isOpen);
      overlay.classList.toggle("is-open", isOpen);
      overlay.setAttribute("aria-hidden", String(!isOpen));
      overlay.inert = !isOpen;

      var focusTarget = isOpen ? overlay.querySelector(".drawer-close") : openButton;
      if (focusTarget) {
        focusTarget.focus({ preventScroll: true });
      }
    }

    openButton.addEventListener("click", function () {
      setMenuOpen(true);
    });

    closeTargets.forEach(function (target) {
      target.addEventListener("click", function () {
        setMenuOpen(false);
      });
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && overlay.classList.contains("is-open")) {
        setMenuOpen(false);
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initSideMenu);
  } else {
    initSideMenu();
  }
})();
