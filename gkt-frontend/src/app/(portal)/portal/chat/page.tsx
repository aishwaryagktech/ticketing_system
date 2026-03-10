/* eslint-disable @next/next/no-img-element */
'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { botApi } from '@/lib/api/bot.api';

interface Message {
  id: string;
  from: 'user' | 'bot';
  text: string;
}

export default function PortalChatPage() {
  const search = useSearchParams();
  const primaryColor = search.get('primary_color') || '#FACC15';
  const logo = search.get('logo');
  const tenantId = search.get('tenant_id');
  const productId = search.get('product_id') || 'portal';
  const [mounted, setMounted] = useState(false);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      from: 'bot',
      text: 'Hi! I’m your ReWire support bot. Ask me anything about your account, tickets, or product.',
    },
  ]);
  const [error, setError] = useState('');
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  if (!mounted) return null;

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput('');
    setError('');

    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const userMsg: Message = { id, from: 'user', text };
    setMessages((prev) => [...prev, userMsg]);
    setSending(true);

    try {
      const res = await botApi.chat(text, productId, tenantId || undefined);
      const replyText = (res.data?.reply as string) || 'Bot did not return a reply.';
      const botMsg: Message = {
        id: `${id}-bot`,
        from: 'bot',
        text: replyText,
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch (e: any) {
      setError(e?.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#020617',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
        padding: 16,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 420,
          height: 560,
          borderRadius: 20,
          border: '1px solid rgba(148,163,184,0.5)',
          background: 'radial-gradient(circle at top, #1d283a 0, #020617 60%)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.8)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            borderBottom: '1px solid rgba(148,163,184,0.4)',
            background: 'rgba(15,23,42,0.9)',
          }}
        >
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 999,
              background: primaryColor,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 16,
            }}
          >
            {logo ? (
              <img
                src={logo}
                alt="Tenant logo"
                style={{ width: '100%', height: '100%', borderRadius: '999px', objectFit: 'cover' }}
              />
            ) : (
              '🤖'
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#E5E7EB' }}>ReWire Support Bot</span>
            <span style={{ fontSize: 11, color: '#9CA3AF' }}>Typically replies in under a minute</span>
          </div>
        </div>

        {/* Messages */}
        <div
          ref={scrollRef}
          style={{
            flex: 1,
            padding: '10px 10px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          {messages.map((m) => (
            <div
              key={m.id}
              style={{
                display: 'flex',
                justifyContent: m.from === 'user' ? 'flex-end' : 'flex-start',
              }}
            >
              <div
                style={{
                  maxWidth: '80%',
                  padding: '8px 10px',
                  borderRadius: 14,
                  fontSize: 12,
                  lineHeight: 1.5,
                  whiteSpace: 'pre-wrap',
              background: m.from === 'user' ? primaryColor : 'rgba(15,23,42,0.9)',
                  color: m.from === 'user' ? '#111827' : '#E5E7EB',
                }}
              >
                {m.text}
              </div>
            </div>
          ))}
          {error && (
            <div style={{ fontSize: 11, color: '#FCA5A5', marginTop: 4 }}>
              {error}
            </div>
          )}
        </div>

        {/* Input */}
        <div
          style={{
            padding: '8px 10px 10px 10px',
            borderTop: '1px solid rgba(148,163,184,0.4)',
            background: 'rgba(15,23,42,0.96)',
            display: 'flex',
            gap: 6,
          }}
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question..."
            style={{
              flex: 1,
              padding: '8px 10px',
              borderRadius: 999,
              border: '1px solid rgba(148,163,184,0.5)',
              background: '#020617',
              color: '#E5E7EB',
              fontSize: 12,
              outline: 'none',
            }}
          />
          <button
            type="button"
            disabled={sending}
            onClick={handleSend}
            style={{
              padding: '8px 12px',
              borderRadius: 999,
              border: 'none',
              background: primaryColor,
              color: '#111827',
              fontSize: 12,
              fontWeight: 600,
              cursor: sending ? 'not-allowed' : 'pointer',
              opacity: sending ? 0.8 : 1,
            }}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
