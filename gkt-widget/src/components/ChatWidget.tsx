import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { WidgetConfig } from '../types/widget.types';
import { MessageBubble } from './MessageBubble';
import { QuickReplies } from './QuickReplies';
import { useWidgetStore } from '../store/widget.store';
import { botApi } from '../api/bot.api';

interface Props {
  config: WidgetConfig;
}

export function ChatWidget({ config }: Props) {
  const { isOpen, toggleOpen, messages, addMessage, sessionId, setSessionId } = useWidgetStore();
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [isDark, setIsDark] = useState(false);

  // Detect host page theme (dark / light) using heuristics
  useEffect(() => {
    try {
      const root = document.documentElement;
      const hasDarkClass = root.classList.contains('dark');
      const dataTheme = (root.getAttribute('data-theme') || '').toLowerCase();
      const colorScheme = getComputedStyle(root).getPropertyValue('color-scheme').toLowerCase();
      const mql = window.matchMedia?.('(prefers-color-scheme: dark)');

      const initialDark =
        hasDarkClass ||
        dataTheme === 'dark' ||
        colorScheme.includes('dark') ||
        mql?.matches;

      setIsDark(initialDark);

      if (mql && typeof mql.addEventListener === 'function') {
        const handler = (e: MediaQueryListEvent) => setIsDark(e.matches);
        mql.addEventListener('change', handler);
        return () => mql.removeEventListener('change', handler);
      }
    } catch {
      // best-effort; default stays light
    }
  }, []);

  // Theme tokens
  const palette = useMemo(
    () => ({
      bgWindow: isDark ? '#020617' : '#FFFFFF',
      bgHeader: isDark ? '#0F172A' : '#0F172A',
      textPrimary: isDark ? '#E5E7EB' : '#0F172A',
      textSecondary: isDark ? '#94A3B8' : '#64748B',
      border: isDark ? '#1f2937' : '#E5E7F0',
      accent: '#2563EB',
      bubbleUserBg: '#2563EB',
      bubbleUserText: '#FFFFFF',
      bubbleBotBg: isDark ? '#1F2937' : '#F3F4F6',
      bubbleBotText: isDark ? '#E5E7EB' : '#111827',
    }),
    [isDark],
  );

  // Load welcome message when chat opened first time
  useEffect(() => {
    if (!isOpen || messages.length > 0) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await botApi.welcome(config.tenantId, config.productId);
        if (cancelled) return;
        const text = String((res as any)?.message || '').trim();
        const welcome =
          text ||
          `Hi! I’m your support assistant for ${config.productName || 'this product'}.\n\nHere are common things I can help with:\n• Login or account access issues\n• Payments, billing & invoices\n• Course / content doubts\n• Technical errors or bugs\n• Product setup & configuration\n\nHow can I help you today?`;
        addMessage({
          id: `bot_welcome_${Date.now()}`,
          body: welcome,
          authorType: 'bot',
          authorName: `${config.productName || 'Support'} bot`,
          timestamp: new Date(),
        });
      } catch {
        if (cancelled) return;
        addMessage({
          id: `bot_welcome_fallback_${Date.now()}`,
          body:
            `Hi! I’m your support assistant.\n\nI can help with things like:\n• Login / account issues\n• Fees, billing & invoices\n• Technical errors on the site\n• Questions about your course or content\n\nTell me what’s going on and I’ll do my best to help.`,
          authorType: 'bot',
          authorName: `${config.productName || 'Support'} bot`,
          timestamp: new Date(),
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, messages.length, addMessage, config.tenantId, config.productId, config.productName]);

  const handleSend = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isThinking || !config.tenantId) return;

      const userMessage = {
        id: `user_${Date.now()}`,
        body: trimmed,
        authorType: 'user' as const,
        authorName: config.userName || 'You',
        timestamp: new Date(),
      };
      addMessage(userMessage);
      setInput('');
      setIsThinking(true);

      try {
        const res = await botApi.chat({
          message: trimmed,
          tenantId: config.tenantId!,
          tenantProductId: config.productId,
          sessionId,
          userId: config.userId,
          userEmail: config.userEmail,
        });
        const reply = String((res as any)?.reply || '').trim();
        const sid = String((res as any)?.session_id || '') || sessionId;
        if (sid && sid !== sessionId) setSessionId(sid);
        if (reply) {
          addMessage({
            id: `bot_${Date.now()}`,
            body: reply,
            authorType: 'bot',
            authorName: `${config.productName || 'Support'} bot`,
            timestamp: new Date(),
          });
        }
      } catch (e: any) {
        addMessage({
          id: `bot_err_${Date.now()}`,
          body:
            'Sorry, I had trouble reaching the support service just now. Please check your connection and try again, or say "human" and I will create a ticket for an agent.',
          authorType: 'bot',
          authorName: `${config.productName || 'Support'} bot`,
          timestamp: new Date(),
        });
      } finally {
        setIsThinking(false);
      }
    },
    [addMessage, config.tenantId, config.productId, config.productName, config.userEmail, config.userId, config.userName, isThinking, sessionId, setSessionId],
  );

  const handleQuickReply = useCallback(
    (value: string) => {
      if (value === 'yes_solved') {
        handleSend('yes');
      } else if (value === 'raise_ticket') {
        handleSend('human');
      } else if (value === 'clarify') {
        handleSend('I need more help.');
      }
    },
    [handleSend],
  );

  const lastBotMessage = useMemo(
    () => [...messages].reverse().find((m) => m.authorType === 'bot') || null,
    [messages],
  );

  const quickReplyOptions =
    lastBotMessage != null
      ? ['Yes, solved', 'Raise ticket', 'Tell me more']
      : [];

  const mapQuickReplyValue = (label: string) => {
    if (label.startsWith('Yes')) return 'yes_solved';
    if (label.startsWith('Raise')) return 'raise_ticket';
    return 'clarify';
  };

  return (
    <>
      {/* Floating bubble */}
      <button
        onClick={toggleOpen}
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          backgroundColor: palette.accent,
          color: '#fff',
          border: 'none',
          cursor: 'pointer',
          fontSize: '24px',
          boxShadow: '0 4px 18px rgba(15,23,42,0.45)',
          zIndex: 9999,
        }}
      >
        💬
      </button>

      {/* Chat window */}
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            bottom: '88px',
            right: '20px',
            width: '380px',
            height: '520px',
            borderRadius: '16px',
            backgroundColor: palette.bgWindow,
            boxShadow: '0 18px 80px rgba(15,23,42,0.85)',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 9999,
            overflow: 'hidden',
            border: `1px solid ${palette.border}`,
          }}
        >
          <div
            style={{
              padding: '14px 16px',
              backgroundColor: palette.bgHeader,
              color: '#F9FAFB',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <strong style={{ fontSize: 14 }}>{config.productName || 'Support'}</strong>
              <div style={{ fontSize: 11, opacity: 0.75 }}>Chatbot</div>
            </div>
          </div>

          <div
            style={{
              flex: 1,
              padding: '12px 14px',
              overflowY: 'auto',
              backgroundColor: isDark ? '#020617' : '#F9FAFB',
            }}
          >
            {messages.map((m) => (
              <MessageBubble
                key={m.id}
                body={m.body}
                authorType={m.authorType as any}
                authorName={m.authorName}
                timestamp={m.timestamp}
              />
            ))}

            {isThinking && (
              <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: 6 }}>
                <div
                  style={{
                    padding: '8px 12px',
                    borderRadius: 999,
                    backgroundColor: palette.bubbleBotBg,
                    color: palette.bubbleBotText,
                    fontSize: 11,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#9CA3AF', animation: 'gkt-dot 1s infinite ease-in-out' }} />
                  <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#9CA3AF', animation: 'gkt-dot 1s infinite ease-in-out', animationDelay: '0.15s' }} />
                  <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#9CA3AF', animation: 'gkt-dot 1s infinite ease-in-out', animationDelay: '0.3s' }} />
                </div>
              </div>
            )}

            {quickReplyOptions.length > 0 && !isThinking && (
              <QuickReplies
                replies={quickReplyOptions}
                onSelect={(label) => handleQuickReply(mapQuickReplyValue(label))}
              />
            )}
          </div>

          <div
            style={{
              padding: '10px 12px',
              borderTop: `1px solid ${palette.border}`,
              backgroundColor: isDark ? '#020617' : '#FFFFFF',
            }}
          >
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend(input);
              }}
              style={{ display: 'flex', gap: 8 }}
            >
              <input
                type="text"
                placeholder="Ask a question..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                style={{
                  flex: 1,
                  padding: '8px 10px',
                  borderRadius: 999,
                  border: `1px solid ${palette.border}`,
                  fontSize: 13,
                  outline: 'none',
                  backgroundColor: isDark ? '#020617' : '#FFFFFF',
                  color: palette.textPrimary,
                }}
              />
              <button
                type="submit"
                disabled={!input.trim() || isThinking}
                style={{
                  padding: '8px 14px',
                  borderRadius: 999,
                  border: 'none',
                  backgroundColor: palette.accent,
                  color: '#FFFFFF',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: !input.trim() || isThinking ? 'not-allowed' : 'pointer',
                  opacity: !input.trim() || isThinking ? 0.7 : 1,
                }}
              >
                Send
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
