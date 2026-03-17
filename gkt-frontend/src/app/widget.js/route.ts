import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest) {
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
  const CHAT_BASE = process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3000';

  const js = `
(function () {
  try {
    var script = document.currentScript;
    if (!script || !script.dataset) return;
    var tenantId = script.dataset.tenant || '';
    var productId = script.dataset.product || '';
    var tenantProductId = script.dataset.tenantProductId || '';
    var userId = script.dataset.userId || '';
    var userEmail = script.dataset.userEmail || '';
    if (!tenantId) return;

    var apiBase = '${API_BASE}';
    var chatBase = '${CHAT_BASE}';

    function createWidget(branding) {
      var primary = (branding && branding.primary_color) || '#FACC15';
      var logo = (branding && branding.logo_base64) || '';
      var name = (branding && branding.name) || 'Support';

      // Build iframe src
      var src = chatBase + '/portal/chat?tenant_id=' + encodeURIComponent(tenantId);
      if (tenantProductId) src += '&tenant_product_id=' + encodeURIComponent(tenantProductId);
      else if (productId) src += '&product_id=' + encodeURIComponent(productId);
      if (userId) src += '&user_id=' + encodeURIComponent(userId);
      if (userEmail) src += '&user_email=' + encodeURIComponent(userEmail);
      src += '&primary_color=' + encodeURIComponent(primary);
      if (logo) src += '&logo=' + encodeURIComponent(logo);

      // Inject styles (data attr so widget-test can clean up on re-renders)
      var style = document.createElement('style');
      style.setAttribute('data-gkt-sidebar-style', 'true');
      style.textContent = [
        '#gkt-sidebar{position:fixed;top:0;right:0;bottom:0;left:auto;z-index:2147483647;display:flex;align-items:center;transition:all 0.36s cubic-bezier(0.4,0,0.2,1);}',
        '#gkt-sidebar-tab{width:24px;height:64px;background:#1c0938;border:1px solid rgba(139,92,246,0.45);border-right:none;border-radius:8px 0 0 8px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#a78bfa;font-size:20px;padding:0;flex-shrink:0;box-shadow:-4px 0 20px rgba(139,92,246,0.2);transition:background 0.2s,color 0.2s;}',
        '#gkt-sidebar-tab:hover{background:#2d1a4e;color:#c4b5fd;}',
        '#gkt-sidebar-iframe{border:none;flex-shrink:0;display:block;transition:width 0.36s cubic-bezier(0.4,0,0.2,1),height 0.36s cubic-bezier(0.4,0,0.2,1);box-shadow:-8px 0 40px rgba(0,0,0,0.7);}',
      ].join('');
      document.head.appendChild(style);

      // Container: tab + iframe
      var container = document.createElement('div');
      container.id = 'gkt-sidebar';

      var tab = document.createElement('button');
      tab.id = 'gkt-sidebar-tab';
      tab.type = 'button';
      tab.innerHTML = '&#8249;'; // ‹ = "open me"
      tab.title = 'Open assistant';
      tab.setAttribute('aria-label', 'Toggle assistant');

      var iframe = document.createElement('iframe');
      iframe.id = 'gkt-sidebar-iframe';
      iframe.src = src;
      iframe.setAttribute('data-gkt-widget', 'chat');
      iframe.setAttribute('allow', 'microphone');

      container.appendChild(tab);
      container.appendChild(iframe);
      document.body.appendChild(container);

      // ── state machine: 'hidden' | 'sidebar' | 'fullscreen' ──────────────────
      var state = 'hidden';

      function sendToIframe(msg) {
        try { iframe.contentWindow && iframe.contentWindow.postMessage(msg, '*'); } catch(e) {}
      }

      function toHidden() {
        state = 'hidden';
        tab.style.display = '';
        tab.innerHTML = '&#8249;'; // ‹
        tab.title = 'Open assistant';
        container.style.left = 'auto';
        container.style.display = 'flex';
        container.style.width = 'auto';
        container.style.transform = 'translateX(320px)'; // only 24px tab visible
        iframe.style.width = '320px';
        iframe.style.height = '100vh';
        sendToIframe({ type: 'gkt-layout-sidebar' });
      }

      function toSidebar() {
        state = 'sidebar';
        tab.style.display = '';
        tab.innerHTML = '&#8650;'; // ↓ = "expand to fullscreen"
        tab.title = 'Open full screen';
        container.style.left = 'auto';
        container.style.display = 'flex';
        container.style.width = 'auto';
        container.style.transform = 'translateX(0)';
        iframe.style.width = '320px';
        iframe.style.height = '100vh';
        sendToIframe({ type: 'gkt-layout-sidebar' });
      }

      function toFullscreen() {
        state = 'fullscreen';
        tab.style.display = 'none';
        container.style.left = '0';
        container.style.display = 'block';
        container.style.width = '100%';
        container.style.transform = 'none';
        iframe.style.width = '100%';
        iframe.style.height = '100vh';
        sendToIframe({ type: 'gkt-layout-fullscreen' });
      }

      // Start hidden
      toHidden();

      tab.addEventListener('click', function () {
        // Any click on the tab opens fullscreen
        toFullscreen();
      });

      // postMessage from iframe
      window.addEventListener('message', function (event) {
        try {
          if (!event || !event.data || typeof event.data !== 'object') return;
          var d = event.data;
          if (d.type === 'gkt-widget-close')    toHidden();
          if (d.type === 'gkt-widget-minimize') toSidebar();
          if (d.type === 'gkt-widget-new-session') {
            iframe.src = src;
            toFullscreen();
          }
        } catch (e) { /* ignore */ }
      });
    }

    // Fetch branding from backend
    fetch(apiBase + '/api/public-config/branding?tenant_id=' + encodeURIComponent(tenantId))
      .then(function (r) {
        if (!r.ok) return null;
        return r.json();
      })
      .then(function (data) {
        createWidget(data || null);
      })
      .catch(function () {
        createWidget(null);
      });
  } catch (e) {
    console.error('GKT widget failed to load', e);
  }
})();`;

  return new Response(js, {
    status: 200,
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

