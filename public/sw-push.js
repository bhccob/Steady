// What a web reminder says when its push arrives. Loaded by the service worker (importScripts)
// and by Jest (require); the words match WEB_COPY in src/notify/copy.ts, which a test checks.
(function (root) {
  var STRINGS = {
    allMarked: "you're all marked.",
    neutral: "a small mark when you're ready.",
    keepComing: 'open steady when you can, so your reminders keep coming.',
  };

  /** rec: the reminder kept on this phone; tomb: present when it was cancelled here (marked). */
  function pushNotice(rec, tomb) {
    if (rec) return { body: rec.body, doseIds: rec.doseIds || [] };
    return { body: tomb ? STRINGS.allMarked : STRINGS.neutral, doseIds: [] };
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { pushNotice: pushNotice, STRINGS: STRINGS };
  else root.steadyPush = { pushNotice: pushNotice, STRINGS: STRINGS };
})(this);
