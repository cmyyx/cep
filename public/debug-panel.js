/**
 * Debug panel — loaded on demand via <script> injection.
 * Placed in public/ so it's served as a static asset.
 *
 * Defines window.__cep_debug__._openPanel() and builds a pure-DOM
 * log viewer with filtering, copy, export, and env info.
 *
 * ================================================================
 * AGENTS.md EXCEPTION NOTES:
 * ================================================================
 *
 * 1. **Inline styles (style attribute on DOM elements)**:
 *    CRASH-RECOVERY TOOL — see bootstrap.ts for full justification.
 *
 * 2. **Bare DOM elements and innerHTML**:
 *    LAST-RESORT debug surface — see bootstrap.ts for full justification.
 *
 * 3. **No TypeScript — plain JS**:
 *    This file is served as a raw static asset; it must be valid JS
 *    without any build step. TSC is configured to ignore public/.
 * ================================================================
 */

;(function () {
  // Guard against double-load
  if (window.__cep_debug__ && window.__cep_debug__._openPanel) return

  var api = window.__cep_debug__
  if (!api) return // bootstrap not loaded yet

  var panelVisible = false
  var panelEl = null
  var currentFilter = 'all'
  var followMode = true // auto-scroll to latest on update
  var followBtn = null // reference to the Follow button

  // ---- helpers ----

  function setFilter(f) {
    currentFilter = f
    var all = document.querySelectorAll('[id^="__d_filter_"]')
    for (var i = 0; i < all.length; i++) {
      all[i].style.fontWeight = all[i].id === '__d_filter_' + f ? '600' : '400'
    }
    renderLogs()
  }

  function redact(text) {
    return text
      .replace(
        /(accessToken|refreshToken|token|password|secret|authorization|credential|key):\s*[^,}\s]+/gi,
        '$1: [REDACTED]'
      )
      .replace(/^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/, '[REDACTED]')
      .replace(/^sk-[A-Za-z0-9]{20,}$/, '[REDACTED]')
  }

  function esc(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  }

  function isHttpLog(e) {
    if (!e.a || e.a.length === 0 || typeof e.a[0] !== 'string') return false
    return (e.l === 'warn' && e.a[0].indexOf('[HTTP]') === 0) ||
           (e.l === 'debug' && e.a[0].indexOf('[API]') === 0)
  }

  // ---- integrity (SHA-256) ----

  function buildLogPayload() {
    var logs = api.getLogs()
    var redacted = []
    for (var i = 0; i < logs.length; i++) {
      var e = logs[i]
      redacted.push({
        time: new Date(e.t).toISOString(),
        level: e.l,
        message: redact(e.a.join(' ')),
      })
    }
    return redacted
  }

  function computeIntegrity(logsArray, callback) {
    if (!window.crypto || !window.crypto.subtle) {
      callback(null)
      return
    }
    try {
      var json = JSON.stringify(logsArray)
      var enc = new TextEncoder().encode(json)
      window.crypto.subtle.digest('SHA-256', enc).then(function (hash) {
        var hex = Array.prototype.map
          .call(new Uint8Array(hash), function (b) {
            return ('00' + b.toString(16)).slice(-2)
          })
          .join('')
        callback(hex)
      }).catch(function () {
        callback(null)
      })
    } catch {
      callback(null)
    }
  }

  // ---- create panel DOM ----

  function createPanel() {
    panelEl = document.createElement('div')
    panelEl.id = '__cep_debug_panel'
    /* Panel: fixed height 60vh, flex column layout.
       Only the log area scrolls; header + footer stay fixed. */
    panelEl.setAttribute(
      'style',
      'display:flex;flex-direction:column;' +
        'position:fixed;bottom:0;left:0;right:0;z-index:2147483646;' +
        'height:60vh;max-height:60vh;overflow:hidden;' +         /* fixed height, no panel-level scroll */
        'background:#1a1a1a;color:#e0e0e0;' +
        'font-family:monospace;font-size:12px;line-height:1.5;' +
        'padding:12px;' +
        'border-top:2px solid #444;' +
        'box-shadow:0 -4px 24px rgba(0,0,0,0.5);'
    )

    /* -- header (fixed) -- */
    var header = document.createElement('div')
    header.setAttribute(
      'style',
      'flex-shrink:0;' +                                           /* don't shrink */
        'display:flex;justify-content:space-between;align-items:center;' +
        'margin-bottom:8px;padding-bottom:6px;border-bottom:1px solid #333;'
    )
    header.innerHTML =
      '<span style="font-weight:600;color:#fff;font-size:13px;">Debug Console</span>' +
      '<div style="display:flex;gap:4px;flex-wrap:wrap;">' +
      '<button id="__d_filter_all" class="__d_filter" data-f="all" style="' +
      BTN_STYLE +
      'font-weight:600;">All</button>' +
      '<button id="__d_filter_error" class="__d_filter" data-f="error" style="' +
      BTN_STYLE +
      'color:#ff6b6b;">Errors</button>' +
      '<button id="__d_filter_warn" class="__d_filter" data-f="warn" style="' +
      BTN_STYLE +
      'color:#ffd93d;">Warn</button>' +
      '<button id="__d_filter_resource" class="__d_filter" data-f="resource" style="' +
      BTN_STYLE +
      'color:#6bcbff;">Res</button>' +
      '<button id="__d_filter_dom" class="__d_filter" data-f="dom" style="' +
      BTN_STYLE +
      'color:#a78bfa;">DOM</button>' +
      '<button id="__d_filter_touch" class="__d_filter" data-f="touch" style="' +
      BTN_STYLE +
      'color:#34d399;">Touch</button>' +
      '<button id="__d_filter_layout" class="__d_filter" data-f="layout" style="' +
      BTN_STYLE +
      'color:#fb923c;">Layout</button>' +
      '<button id="__d_filter_http" class="__d_filter" data-f="http" style="' +
      BTN_STYLE +
      'color:#60a5fa;">HTTP</button>' +
      '<button id="__d_copy" style="' +
      BTN_STYLE +
      '">Copy</button>' +
      '<button id="__d_export" style="' +
      BTN_STYLE +
      '">Export</button>' +
      '<button id="__d_close" style="' +
      BTN_STYLE +
      'background:rgba(255,255,255,0.12);">Close</button>' +
      '</div>'
    panelEl.appendChild(header)

    /* -- log container (scrollable, fills remaining space) -- */
    var logContainer = document.createElement('div')
    logContainer.id = '__d_logs'
    logContainer.setAttribute(
      'style',
      'flex:1 1 0;min-height:0;overflow-y:auto;' +                 /* fill height, scroll internally */
        '-webkit-overflow-scrolling:touch;overscroll-behavior:contain;'
    )
    panelEl.appendChild(logContainer)

    /* -- Follow button (absolute, overlaying bottom-right of log area) -- */
    followBtn = document.createElement('button')
    followBtn.id = '__d_follow'
    followBtn.textContent = 'Follow \u2193'
    followBtn.setAttribute(
      'style',
      'display:none;position:absolute;bottom:44px;right:16px;' +
        'padding:4px 12px;background:rgba(59,130,246,0.9);color:#fff;border:none;' +
        'border-radius:4px;font-size:11px;font-family:system-ui;cursor:pointer;' +
        'z-index:1;'
    )
    panelEl.appendChild(followBtn)

    /* Scroll detection — toggle follow mode based on scroll position */
    logContainer.addEventListener('scroll', function () {
      var gap = logContainer.scrollHeight - logContainer.scrollTop - logContainer.clientHeight
      if (followMode && gap > 100) {
        // User scrolled up — exit follow mode
        followMode = false
        followBtn.style.display = 'block'
      } else if (!followMode && gap < 10) {
        // User scrolled back to bottom — re-enter follow mode
        followMode = true
        followBtn.style.display = 'none'
      }
    })

    /* -- env info footer (fixed) -- */
    var envEl = document.createElement('div')
    envEl.id = '__d_env'
    envEl.setAttribute(
      'style',
      'flex-shrink:0;' +                                           /* don't shrink */
        'margin-top:6px;padding-top:6px;border-top:1px solid #333;' +
        'font-size:11px;color:#888;'
    )
    panelEl.appendChild(envEl)

    document.body.appendChild(panelEl)

    /* Delegate all button clicks at document level (capture phase).
       This survives Next.js error overlay which registers its own
       document capture handler that calls stopPropagation().
       Same-node same-phase handlers fire in registration order;
       stopPropagation only blocks children, not siblings. */
    document.addEventListener('click', function (e) {
      var id = e.target.id
      if (id === '__d_copy') { copyLogs(); return }
      if (id === '__d_export') { exportLogs(); return }
      if (id === '__d_close') { closePanel(); return }
      if (id === '__d_filter_all') { setFilter('all'); return }
      if (id === '__d_filter_error') { setFilter('error'); return }
      if (id === '__d_filter_warn') { setFilter('warn'); return }
      if (id === '__d_filter_resource') { setFilter('resource'); return }
      if (id === '__d_filter_dom') { setFilter('dom'); return }
      if (id === '__d_filter_touch') { setFilter('touch'); return }
      if (id === '__d_filter_layout') { setFilter('layout'); return }
      if (id === '__d_filter_http') { setFilter('http'); return }
      if (id === '__d_follow') { followMode = true; followBtn.style.display = 'none'; var lc = document.getElementById('__d_logs'); if (lc) lc.scrollTop = lc.scrollHeight; return }
    }, true)
  }

  var BTN_STYLE =
    'padding:4px 10px;background:rgba(255,255,255,0.08);color:#ccc;border:1px solid rgba(255,255,255,0.12);border-radius:4px;font-size:11px;font-family:system-ui;cursor:pointer;white-space:nowrap;'

  // ---- render ----

  function renderLogs() {
    var logContainer = document.getElementById('__d_logs')
    var envEl = document.getElementById('__d_env')
    if (!logContainer || !envEl) return

    var logs = api.getLogs()
    var filtered =
      currentFilter === 'all'
        ? logs
        : logs.filter(function (e) {
            if (currentFilter === 'error') return e.l === 'error' || e.l === 'resource'
            if (currentFilter === 'layout') return e.l === 'layout' || e.l === 'env'
            if (currentFilter === 'http') return isHttpLog(e)
            return e.l === currentFilter
          })

    var html = ''
    if (filtered.length === 0) {
      html =
        '<div style="color:#666;padding:20px;text-align:center;">No entries yet.</div>'
    } else {
      for (var i = 0; i < filtered.length; i++) {
        var e = filtered[i]
        var lc =
          e.l === 'error'
            ? '#ff6b6b'
            : isHttpLog(e)
              ? '#60a5fa'
              : e.l === 'warn'
                ? '#ffd93d'
                : e.l === 'resource'
                  ? '#6bcbff'
                  : e.l === 'dom'
                    ? '#a78bfa'
                    : e.l === 'touch'
                      ? '#34d399'
                      : e.l === 'layout' || e.l === 'env'
                        ? '#fb923c'
                        : '#aaa'
        var ts = new Date(e.t).toLocaleTimeString()
        var tx = e.a
          .map(function (s) {
            return redact(s)
          })
          .join(' ')
        html +=
          '<div style="padding:3px 0;border-bottom:1px solid rgba(255,255,255,0.04);word-break:break-all;">' +
          '<span style="color:#666;">' +
          ts +
          '</span>' +
          '<span style="color:' +
          lc +
          ';margin-left:8px;">[' +
          e.l.toUpperCase() +
          ']</span>' +
          '<span style="color:#ddd;margin-left:8px;">' +
          esc(tx) +
          '</span>' +
          '</div>'
      }
    }
    logContainer.innerHTML = html

    // Auto-scroll to bottom if in follow mode
    if (followMode) {
      logContainer.scrollTop = logContainer.scrollHeight
    }

    // Env info
    var env = api.getEnv()
    var keys = Object.keys(env)
    var envHtml = ''
    for (var k = 0; k < keys.length; k++) {
      envHtml +=
        '<span style="margin-right:16px;"><strong>' +
        esc(keys[k]) +
        ':</strong> ' +
        esc(String(env[keys[k]])) +
        '</span>'
    }
    // Injected element count from MutationObserver
    if (api._injectedCount) {
      var ic = api._injectedCount()
      if (ic > 0) {
        envHtml +=
          '<span style="margin-right:16px;color:#a78bfa;"><strong>injected:</strong> ' +
          ic +
          '</span>'
      }
    }
    envEl.innerHTML = envHtml
  }

  // ---- actions ----

  function copyLogs() {
    var logs = api.getLogs()
    var text = ''
    for (var i = 0; i < logs.length; i++) {
      var e = logs[i]
      text +=
        '[' +
        new Date(e.t).toISOString() +
        '] [' +
        e.l.toUpperCase() +
        '] ' +
        redact(e.a.join(' ')) +
        '\n'
    }

    // Append integrity line
    var payload = buildLogPayload()
    computeIntegrity(payload, function (hash) {
      var fullText = text
      if (hash) {
        fullText += '\n--- Integrity: sha256:' + hash + ' (' + payload.length + ' entries) ---'
      } else {
        fullText += '\n--- Integrity: unavailable (non-HTTPS) ---'
      }

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(fullText).then(
          function () {
            showToast('Copied ' + logs.length + ' entries')
          },
          function () {
            fallbackCopy(fullText)
          }
        )
      } else {
        fallbackCopy(fullText)
      }
    })
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('style', 'position:fixed;top:-9999px;')
    document.body.appendChild(ta)
    ta.select()
    try {
      document.execCommand('copy')
      showToast('Copied to clipboard')
    } catch {
      alert(
        'Copy failed. Please select and copy manually:\n\n' + text.substring(0, 2000)
      )
    }
    document.body.removeChild(ta)
  }

  function exportLogs() {
    var env = api.getEnv()
    var payload = buildLogPayload()

    computeIntegrity(payload, function (hash) {
      var data = {
        env: env,
        logs: payload,
        integrity: hash
          ? {
              algorithm: 'sha256',
              hash: hash,
              entryCount: payload.length,
            }
          : {
              algorithm: 'none',
              note: 'integrity unavailable (non-HTTPS context)',
              entryCount: payload.length,
            },
      }

      var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      var url = URL.createObjectURL(blob)
      var a = document.createElement('a')
      a.href = url
      a.download = 'cep-debug-' + Date.now() + '.json'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      showToast('Exported ' + payload.length + ' log entries')
    })
  }

  function showToast(msg) {
    var t = document.createElement('div')
    t.textContent = msg
    /* INLINE STYLE — crash-recovery tool */
    t.setAttribute(
      'style',
      'position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:2147483647;' +
        'background:rgba(0,0,0,0.85);color:#fff;padding:8px 16px;border-radius:6px;' +
        'font-family:system-ui;font-size:13px;pointer-events:none;' +
        'animation:__cep_toast 2.2s ease forwards;'
    )
    document.body.appendChild(t)
    setTimeout(function () {
      if (t.parentNode) t.parentNode.removeChild(t)
    }, 2300)
  }

  // ---- open / close ----

  function startRefresh() {
    stopRefresh()
    api._onLog = renderLogs
  }

  function stopRefresh() {
    api._onLog = null
  }

  function openPanelOnly() {
    /* Hide the floating label while panel is visible */
    var lbl = document.getElementById('__cep_debug_label')
    if (lbl) lbl.style.display = 'none'

    // Reset follow mode on open
    followMode = true
    if (followBtn) followBtn.style.display = 'none'

    if (!panelEl) {
      createPanel()
      panelVisible = true
      renderLogs()
      startRefresh()
      return
    }
    if (!panelVisible) {
      panelVisible = true
      panelEl.style.display = 'flex'   /* flex, not block, because panel is flex container */
      renderLogs()
      startRefresh()
    }
  }

  function closePanel() {
    stopRefresh()
    if (panelEl && panelVisible) {
      panelVisible = false
      panelEl.style.display = 'none'
    }
    /* Restore the label if it still exists (may have been auto-hidden by onload timer) */
    var lbl = document.getElementById('__cep_debug_label')
    if (lbl) lbl.style.display = ''
  }

  // ---- inject toast animation ----
  var styleEl = document.createElement('style')
  styleEl.textContent =
    '@keyframes __cep_toast{0%{opacity:0;transform:translateX(-50%) translateY(-8px)}' +
    '15%{opacity:1;transform:translateX(-50%) translateY(0)}' +
    '85%{opacity:1;transform:translateX(-50%) translateY(0)}' +
    '100%{opacity:0;transform:translateX(-50%) translateY(-8px)}}'
  document.head.appendChild(styleEl)

  // ---- expose ----

  api._openPanel = openPanelOnly
  api._togglePanel = function () {
    if (panelVisible) closePanel()
    else openPanelOnly()
  }
})()
