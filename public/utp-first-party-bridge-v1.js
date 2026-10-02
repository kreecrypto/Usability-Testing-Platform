(function () {
  "use strict";

  var protocol = "utp:first-party-web";
  var bridgeVersion = "first-party-web-v1";
  var openerOrigin = null;
  var screenId = null;
  var started = false;
  var scrollPending = false;

  function stableId(value, field) {
    if (typeof value !== "string" || !value.trim() || value.trim().length > 512) {
      throw new Error("invalid_" + field);
    }
    return value.trim();
  }

  function send(type, data) {
    if (!started || !window.opener || window.opener.closed) return false;
    window.opener.postMessage({ protocol: protocol, version: 1, type: type, data: data }, openerOrigin);
    return true;
  }

  function currentRoute() { return window.location.pathname; }
  function currentUrl() { return window.location.origin + window.location.pathname; }

  function screenView(next, previous) {
    send("screen_view", {
      screenId: next,
      ...(previous ? { previousScreenId: previous } : {}),
      route: currentRoute(),
      url: currentUrl()
    });
  }

  function recordPointer(event) {
    if (!screenId) return;
    var element = event.target instanceof Element ? event.target.closest("[data-utp-element-id]") : null;
    var elementId = element ? element.getAttribute("data-utp-element-id") : null;
    send("pointer", {
      screenId: screenId,
      x: event.clientX,
      y: event.clientY,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      ...(elementId ? { elementId: elementId } : {})
    });
  }

  function recordScroll() {
    if (!screenId || scrollPending) return;
    scrollPending = true;
    window.requestAnimationFrame(function () {
      scrollPending = false;
      send("scroll", {
        screenId: screenId,
        scrollX: window.scrollX,
        scrollY: window.scrollY,
        documentWidth: document.documentElement.scrollWidth,
        documentHeight: document.documentElement.scrollHeight
      });
    });
  }

  window.UTPFirstPartyBridge = Object.freeze({
    start: function (options) {
      if (started) return true;
      if (!options || !window.opener || window.opener.closed) return false;
      var url = new URL(options.utpOrigin);
      if (!(url.protocol === "https:" || (url.protocol === "http:" && url.hostname === "localhost")) || url.origin !== options.utpOrigin) {
        throw new Error("invalid_utp_origin");
      }
      openerOrigin = url.origin;
      screenId = stableId(options.screenId, "screen_id");
      started = true;
      document.addEventListener("click", recordPointer, { passive: true });
      window.addEventListener("scroll", recordScroll, { passive: true });
      send("ready", { bridgeVersion: bridgeVersion });
      screenView(screenId);
      return true;
    },
    setScreen: function (nextScreenId) {
      if (!started) return false;
      var next = stableId(nextScreenId, "screen_id");
      var previous = screenId;
      screenId = next;
      screenView(next, previous);
      return true;
    },
    completionSignal: function (signalId) {
      if (!started) return false;
      return send("completion_signal", { signalId: stableId(signalId, "signal_id"), screenId: screenId });
    }
  });
}());
