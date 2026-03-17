import React from 'react';

interface Props {
  replies: string[];
  onSelect: (reply: string) => void;
}

export function QuickReplies({ replies, onSelect }: Props) {
  if (!replies.length) return null;
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '10px 0' }}>
      {replies.map((reply) => (
        <button
          key={reply}
          type="button"
          onClick={() => onSelect(reply)}
          style={{
            padding: '6px 14px',
            borderRadius: 999,
            border: '1px solid rgba(37,99,235,0.5)',
            backgroundColor: '#0B1120',
            color: '#BFDBFE',
            cursor: 'pointer',
            fontSize: 12,
          }}
        >
          {reply}
        </button>
      ))}
    </div>
  );
}
