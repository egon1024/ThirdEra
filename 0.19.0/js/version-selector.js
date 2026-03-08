/**
 * Version selector for mike-deployed docs. Fetches versions.json from the
 * deploy root and injects a dropdown; on change, navigates to the same path
 * under the selected version. No-op if versions.json is missing (e.g. local serve).
 */
(function () {
  // #region agent log
  var log = function (hypothesisId, message, data) {
    fetch('http://127.0.0.1:7244/ingest/3e68fb46-28cf-4993-8150-24eb15233806', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '2b1e1a' }, body: JSON.stringify({ sessionId: '2b1e1a', hypothesisId: hypothesisId, location: 'version-selector.js', message: message, data: data || {}, timestamp: Date.now() }) }).catch(function () {});
  };
  // #endregion
  var script = document.currentScript;
  if (!script || !script.src) {
    log('A', 'early exit: no script or src', {});
    return;
  }

  var scriptPath = new URL(script.src).pathname;
  var segments = scriptPath.split('/').filter(Boolean);
  // #region agent log
  log('A', 'computed path info', { scriptPath: scriptPath, segmentsLength: segments.length, segments: segments });
  // #endregion
  // Script lives at <deploy_root>/<version>/js/version-selector.js
  if (segments.length < 2) {
    log('A', 'early exit: segments.length < 2', {});
    return;
  }
  var versionSegmentIndex = segments.length - 2;
  var deployRootSegments = segments.slice(0, versionSegmentIndex);
  var deployRoot = deployRootSegments.length ? '/' + deployRootSegments.join('/') + '/' : '/';
  var versionsUrl = deployRoot + 'versions.json';
  var currentVersion = segments[versionSegmentIndex];
  // #region agent log
  log('A', 'deploy root and url', { deployRoot: deployRoot, versionsUrl: versionsUrl, currentVersion: currentVersion });
  // #endregion

  fetch(versionsUrl)
    .then(function (r) {
      // #region agent log
      log('B', 'fetch response', { ok: r.ok, status: r.status, url: r.url });
      // #endregion
      return r.ok ? r.json() : Promise.reject(new Error('fetch not ok'));
    })
    .then(function (versions) {
      // #region agent log
      log('C', 'versions parsed', { isArray: Array.isArray(versions), length: versions ? versions.length : 0 });
      // #endregion
      if (!Array.isArray(versions) || versions.length === 0) return;
      var select = document.createElement('select');
      select.className = 'version-selector';
      select.setAttribute('aria-label', 'Documentation version');

      versions.forEach(function (v) {
        var title = v.title || v.version;
        var opt = document.createElement('option');
        opt.value = v.version;
        opt.textContent = title;
        if (v.aliases && v.aliases.indexOf('latest') !== -1) opt.textContent += ' (latest)';
        if (v.version === currentVersion) opt.selected = true;
        select.appendChild(opt);
      });

      select.addEventListener('change', function () {
        var ver = select.value;
        if (ver === currentVersion) return;
        var base = deployRoot + ver + '/';
        var path = window.location.pathname.slice(deployRoot.length);
        var rest = path.replace(/^[^/]+\//, '');
        window.location.href = base + rest || base;
      });

      var nav = document.querySelector('nav');
      var wrap = document.createElement('div');
      wrap.className = 'version-selector-wrap';
      wrap.appendChild(select);
      if (nav) {
        nav.appendChild(wrap);
        log('D', 'appended to nav', { hasNav: true });
      } else {
        document.body.insertBefore(wrap, document.body.firstChild);
        log('D', 'appended to body', { hasNav: false });
      }
    })
    .catch(function (err) {
      // #region agent log
      log('E', 'fetch or parse error', { message: err && err.message, name: err && err.name });
      // #endregion
    });
})();
