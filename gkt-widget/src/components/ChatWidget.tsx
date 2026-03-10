import React, { useState } from 'react';
import { WidgetConfig } from '../types/widget.types';
import { MessageBubble } from './MessageBubble';
import { QuickReplies } from './QuickReplies';

interface Props { config: WidgetConfig; }

export function ChatWidget({ config }: Props) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Floating bubble */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: 'fixed', bottom: '20px', right: '20px', width: '56px', height: '56px',
          borderRadius: '50%', backgroundColor: '#2563EB', color: '#fff', border: 'none',
          cursor: 'pointer', fontSize: '24px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          zIndex: 9999,
        }}
      >
        💬
      </button>

      {/* Chat window */}
      {isOpen && (
        <div style={{
          position: 'fixed', bottom: '88px', right: '20px', width: '380px', height: '520px',
          borderRadius: '16px', backgroundColor: '#fff', boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
          display: 'flex', flexDirection: 'column', zIndex: 9999, overflow: 'hidden',
        }}>
          <div style={{ padding: '16px', backgroundColor: '#2563EB', color: '#fff' }}>
            <strong>{config.productName || 'Support'}</strong>
          </div>
          <div style={{ flex: 1, padding: '16px', overflowY: 'auto' }}>
            {/* TODO: Message thread */}
          </div>
          <div style={{ padding: '12px', borderTop: '1px solid #e5e7eb' }}>
            <input
              type="text"
              placeholder="Type a message..."
              style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #d1d5db' }}
            />
          </div>
        </div>
      )}
    </>
  );
}
