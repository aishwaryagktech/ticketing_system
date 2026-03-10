import React from 'react';
import ReactDOM from 'react-dom/client';
import { bootstrap } from './bootstrap';
import { ChatWidget } from './components/ChatWidget';
import { FormWidget } from './components/FormWidget';

// Read data-* attributes from the script tag
const scriptTag = document.currentScript as HTMLScriptElement | null;

if (scriptTag) {
  const config = bootstrap(scriptTag);

  if (config) {
    const type = scriptTag.getAttribute('data-type') || 'chat';
    const containerId = scriptTag.getAttribute('data-container');

    let root: HTMLElement;

    if (containerId) {
      root = document.getElementById(containerId)!;
    } else {
      root = document.createElement('div');
      root.id = 'gkt-widget-root';
      document.body.appendChild(root);
    }

    // Attach Shadow DOM
    const shadow = root.attachShadow({ mode: 'open' });
    const mountPoint = document.createElement('div');
    shadow.appendChild(mountPoint);

    ReactDOM.createRoot(mountPoint).render(
      <React.StrictMode>
        {type === 'form' ? <FormWidget config={config} /> : <ChatWidget config={config} />}
      </React.StrictMode>
    );
  }
}
