(function () {
  var lastTap = {
    time: 0,
    x: 0,
    y: 0
  };
  var maxDelay = 350;
  var maxDistance = 24;

  function getTouch(event) {
    if (!event.touches || event.touches.length !== 1) {
      return null;
    }

    return event.touches[0];
  }

  document.addEventListener("touchstart", function (event) {
    var touch = getTouch(event);

    if (!touch) {
      return;
    }

    var now = Date.now();
    var deltaTime = now - lastTap.time;
    var deltaX = Math.abs(touch.clientX - lastTap.x);
    var deltaY = Math.abs(touch.clientY - lastTap.y);

    if (deltaTime > 0 && deltaTime < maxDelay && deltaX < maxDistance && deltaY < maxDistance) {
      event.preventDefault();
    }

    lastTap = {
      time: now,
      x: touch.clientX,
      y: touch.clientY
    };
  }, { passive: false });
}());
