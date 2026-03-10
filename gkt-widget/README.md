# GKT Widget

Standalone embeddable chatbot + ticket form widget for the GKT AI-Enabled Ticketing System.

## Quick Start

```bash
npm install
npm run dev
```

Widget dev server runs at `http://localhost:4000`.

## Build

```bash
npm run build
```

Outputs `dist/widget.js` — a single standalone bundle.

## Integration

Clients paste one script tag to embed the chatbot or form:

```html
<!-- Chatbot Widget -->
<script
  src="https://widget.gkt.app/widget.js"
  data-product-id="rewire_prod_xxx"
  data-user-id="john_123"
  data-user-email="john@abc.edu"
  data-user-type="tenant_user">
</script>
```

See `project-setup.md` for full integration guide and all supported `data-*` attributes.
