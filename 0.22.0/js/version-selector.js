/**
 * Version selector for mike-deployed docs. Fetches versions.json from the
 * deploy root and injects a dropdown; on change, navigates to the same path
 * under the selected version. No-op if versions.json is missing (e.g. local serve).
 */
(function () {
  var script = document.currentScript;
  if (!script || !script.src) return;

  var scriptPath = new URL(script.src).pathname;
  var segments = scriptPath.split('/').filter(Boolean);
  // Script lives at <deploy_root>/<version_or_alias>/js/version-selector.js
  // versions.json is at deploy root (parent of version dir), not inside version dir
  if (segments.length < 3) return;
  var versionSegmentIndex = segments.length - 2;
  var deployRootSegments = segments.slice(0, Math.max(0, versionSegmentIndex - 1));
  var deployRoot = deployRootSegments.length ? '/' + deployRootSegments.join('/') + '/' : '/';
  var versionsUrl = deployRoot + 'versions.json';
  var currentVersion = segments[versionSegmentIndex];

  fetch(versionsUrl)
    .then(function (r) { return r.ok ? r.json() : Promise.reject(); })
    .then(function (versions) {
      if (!Array.isArray(versions) || versions.length === 0) return;
      var select = document.createElement('select');
      select.className = 'version-selector';
      select.setAttribute('aria-label', 'Documentation version');

      versions.forEach(function (v) {
        var hidden = v.properties && v.properties.hidden;
        if (hidden && v.version !== currentVersion) return;  // hide from dropdown unless current
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
      } else {
        document.body.insertBefore(wrap, document.body.firstChild);
      }
    })
    .catch(function () {});
})();
