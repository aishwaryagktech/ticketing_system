import React from 'react';
import { WidgetConfig } from '../types/widget.types';

interface Props { config: WidgetConfig; }

export function FormWidget({ config }: Props) {
  return (
    <div style={{ padding: '24px', fontFamily: 'system-ui, sans-serif' }}>
      <h2 style={{ marginBottom: '16px' }}>Submit a Ticket</h2>
      <form>
        <div style={{ marginBottom: '12px' }}>
          <label>Subject</label>
          <input type="text" style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #d1d5db' }} />
        </div>
        <div style={{ marginBottom: '12px' }}>
          <label>Description</label>
          <textarea rows={5} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #d1d5db' }} />
        </div>
        <button type="submit" style={{ padding: '10px 20px', backgroundColor: '#2563EB', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
          Submit
        </button>
      </form>
    </div>
  );
}
