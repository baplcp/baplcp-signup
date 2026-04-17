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
    '          <a class="drawer-link" href="./group-list.html"><span class="drawer-icon"><img src="./images/Registration list.png" alt=""></span><span>已發起的球局</span></a>',
    '          <a class="drawer-link" href="https://store.line.me/stickershop/product/30532466/" target="_blank" rel="noreferrer"><span class="drawer-icon is-warm"><img src="./images/icon-donate.png" alt=""></span><span>贊助胖貓貓</span></a>',
    '        </nav>',
    '      </section>',
    '    </div>',
    '    <div class="drawer-footer">',
    '      <a class="drawer-create-button" href="./create-activity.html">建立新球局</a>',
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
