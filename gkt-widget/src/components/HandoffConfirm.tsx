import React from 'react';

interface Props { ticketNumber: string; }

export function HandoffConfirm({ ticketNumber }: Props) {
  return (
    <div style={{ padding: '16px', textAlign: 'center', backgroundColor: '#f0fdf4', borderRadius: '8px' }}>
      <div style={{ fontSize: '24px', marginBottom: '8px' }}>✅</div>
      <strong>Ticket Created</strong>
      <p style={{ color: '#666', marginTop: '4px' }}>Your ticket <strong>{ticketNumber}</strong> has been submitted. An agent will respond shortly.</p>
    </div>
  );
}
