import React from 'react';

interface Props { replies: string[]; onSelect: (reply: string) => void; }

export function QuickReplies({ replies, onSelect }: Props) {
  return (
    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', padding: '8px 0' }}>
      {replies.map((reply, i) => (
        <button key={i} onClick={() => onSelect(reply)} style={{
          padding: '6px 14px', borderRadius: '16px', border: '1px solid #2563EB',
          backgroundColor: '#fff', color: '#2563EB', cursor: 'pointer', fontSize: '13px',
        }}>
          {reply}
        </button>
      ))}
    </div>
  );
}
