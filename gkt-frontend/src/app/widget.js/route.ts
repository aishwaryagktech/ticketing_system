import { NextRequest } from 'next/server';

export const dynamic = 'force-static';

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

      // Launcher button
      var launcher = document.createElement('button');
      launcher.type = 'button';
      launcher.setAttribute('data-gkt-widget-launcher', 'chat');
      launcher.style.position = 'fixed';
      launcher.style.bottom = '20px';
      launcher.style.right = '20px';
      launcher.style.width = '52px';
      launcher.style.height = '52px';
      launcher.style.borderRadius = '999px';
      launcher.style.border = 'none';
      launcher.style.padding = '0';
      launcher.style.cursor = 'pointer';
      launcher.style.background = primary;
      launcher.style.boxShadow = '0 18px 40px rgba(15,23,42,0.65)';
      launcher.style.zIndex = '2147483647';
      launcher.style.display = 'flex';
      launcher.style.alignItems = 'center';
      launcher.style.justifyContent = 'center';

      if (logo) {
        var img = document.createElement('img');
        img.src = logo;
        img.alt = name + ' logo';
        img.style.width = '60%';
        img.style.height = '60%';
        img.style.objectFit = 'contain';
        img.style.borderRadius = '999px';
        launcher.appendChild(img);
      } else {
        var span = document.createElement('span');
        span.textContent = '💬';
        span.style.fontSize = '22px';
        launcher.appendChild(span);
      }

      // Chat iframe (initially hidden)
      var iframe = document.createElement('iframe');
      var src = chatBase + '/portal/chat?tenant_id=' + encodeURIComponent(tenantId);
      if (tenantProductId) src += '&tenant_product_id=' + encodeURIComponent(tenantProductId);
      else if (productId) src += '&product_id=' + encodeURIComponent(productId);
      if (userId) src += '&user_id=' + encodeURIComponent(userId);
      if (userEmail) src += '&user_email=' + encodeURIComponent(userEmail);
      src += '&primary_color=' + encodeURIComponent(primary);
      if (logo) {
        src += '&logo=' + encodeURIComponent(logo);
      }
      iframe.src = src;
      iframe.style.position = 'fixed';
      iframe.style.bottom = '84px';
      iframe.style.right = '20px';
      iframe.style.width = '380px';
      iframe.style.height = '520px';
      iframe.style.border = 'none';
      iframe.style.borderRadius = '18px';
      iframe.style.boxShadow = '0 20px 40px rgba(15,23,42,0.65)';
      iframe.style.zIndex = '2147483647';
      iframe.setAttribute('data-gkt-widget', 'chat');
      iframe.style.display = 'none';

      function adjustSize() {
        try {
          var maxHeight = window.innerHeight ? (window.innerHeight - 140) : 520;
          if (maxHeight < 320) maxHeight = 320;
          var h = Math.min(520, maxHeight);
          iframe.style.height = h + 'px';
        } catch (e) {
          // ignore
        }
      }
      adjustSize();
      window.addEventListener('resize', adjustSize);

      var open = false;
      launcher.addEventListener('click', function () {
        open = !open;
        iframe.style.display = open ? 'block' : 'none';
      });

      // Allow the iframe to request close/reset via postMessage
      window.addEventListener('message', function (event) {
        try {
          if (!event || !event.data) return;
          var data = event.data;
          if (typeof data !== 'object') return;
          if (data.type === 'gkt-widget-close') {
            open = false;
            iframe.style.display = 'none';
          }
          if (data.type === 'gkt-widget-new-session') {
            // Reload iframe src without cached session_id so chat starts fresh
            iframe.src = iframe.src.split('#')[0];
            open = true;
            iframe.style.display = 'block';
          }
        } catch (e) {
          // ignore
        }
      });

      document.body.appendChild(iframe);
      document.body.appendChild(launcher);
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
      'Cache-Control': 'public, max-age=60',
    },
  });
}

