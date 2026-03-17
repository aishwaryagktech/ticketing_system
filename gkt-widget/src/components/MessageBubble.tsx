import React from 'react';

interface Props {
  body: string;
  authorType: 'user' | 'agent' | 'bot' | 'system';
  authorName: string;
  timestamp: Date;
}

export function MessageBubble({ body, authorType, authorName }: Props) {
  const isUser = authorType === 'user';
  const lines = body.split('\n');

  return (
    <div style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', marginBottom: '8px' }}>
      <div
        style={{
          maxWidth: '80%',
          padding: '10px 14px',
          borderRadius: '12px',
          backgroundColor: isUser ? '#2563EB' : '#1F2937',
          color: isUser ? '#fff' : '#E5E7EB',
          fontSize: 13,
          lineHeight: 1.5,
        }}
      >
        <div style={{ fontSize: '11px', opacity: 0.7, marginBottom: '4px' }}>{authorName}</div>
        <div>
          {lines.map((ln, idx) => (
            <div key={idx} style={{ marginBottom: ln.trim().startsWith('•') || ln.trim().match(/^[0-9]+\./) ? 2 : 4 }}>
              {ln}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
