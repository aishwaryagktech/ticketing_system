import React from 'react';

interface Props {
  body: string;
  authorType: 'user' | 'agent' | 'bot' | 'system';
  authorName: string;
  timestamp: Date;
}

export function MessageBubble({ body, authorType, authorName, timestamp }: Props) {
  const isUser = authorType === 'user';
  return (
    <div style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', marginBottom: '8px' }}>
      <div style={{
        maxWidth: '80%', padding: '10px 14px', borderRadius: '12px',
        backgroundColor: isUser ? '#2563EB' : '#f3f4f6',
        color: isUser ? '#fff' : '#111',
      }}>
        <div style={{ fontSize: '11px', opacity: 0.7, marginBottom: '4px' }}>{authorName}</div>
        <div>{body}</div>
      </div>
    </div>
  );
}
