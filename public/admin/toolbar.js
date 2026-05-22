/* eslint-disable */
/**
 * Decap editor toolbar simplifier.
 *
 * Hides controls that aren't useful for a single-editor workflow:
 *   - "Delete published entry" button (destructive; not needed routinely)
 *   - "Check for Preview" link (we have preview disabled per-collection)
 *   - "In Review" and "Ready" entries in the publish-status dropdown
 *     (the editorial_workflow's middle stages — only Draft + Published
 *     are exposed)
 *
 * Decap's class names aren't stable, so we match by visible text content
 * inside a MutationObserver. One-frame throttle keeps the overhead trivial.
 */
(function () {
  var TARGETS_BUTTON = [
    /^delete\b.*entry/i, // Delete entry / Delete published entry
    /^check for preview/i,
  ];
  var TARGETS_MENUITEM = [/^in review$/i, /^ready$/i];

  function shouldHideButton(el) {
    var t = (el.textContent || "").trim();
    return TARGETS_BUTTON.some(function (re) {
      return re.test(t);
    });
  }
  function shouldHideMenuitem(el) {
    var t = (el.textContent || "").trim();
    return TARGETS_MENUITEM.some(function (re) {
      return re.test(t);
    });
  }

  function clean() {
    var btns = document.querySelectorAll("button, a");
    for (var i = 0; i < btns.length; i++) {
      var el = btns[i];
      if (el.dataset && el.dataset.binHidden) continue;
      if (shouldHideButton(el)) {
        el.style.display = "none";
        el.dataset.binHidden = "1";
      }
    }
    // Dropdown items can be li/role-menuitem/various div shells; match
    // anything with a short text-content equal to a target label.
    var items = document.querySelectorAll(
      '[role="menuitem"], [class*="DropdownItem"], li'
    );
    for (var j = 0; j < items.length; j++) {
      var el2 = items[j];
      if (el2.dataset && el2.dataset.binHidden) continue;
      if (shouldHideMenuitem(el2)) {
        el2.style.display = "none";
        el2.dataset.binHidden = "1";
      }
    }
  }

  var scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(function () {
      scheduled = false;
      clean();
    });
  }

  function start() {
    clean();
    var obs = new MutationObserver(schedule);
    obs.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
