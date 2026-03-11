'use client';

import React, { useState } from 'react';
import { useSearchParams } from 'next/navigation';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export default function PublicSupportFormPage() {
  const search = useSearchParams();
  const tenantId = search.get('tenant_id') || null;
  const tenantProductId = search.get('tenant_product_id') || null;
  // `product_id` is the parent product; keep tenant_product_id separate
  const productId = search.get('product_id') || null;
  const [name, setName] = useState('');
  const [email, setEmail] = useState('aishh2305@gmail.com');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);
  const [aiPriority, setAiPriority] = useState<string | null>(null);
  const [step, setStep] = useState<'form' | 'review' | 'done'>('form');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setResult(null);
    setAiSuggestion(null);
    setAiPriority(null);
    try {
      const res = await fetch(`${API_BASE}/api/widget/support-suggest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tenant_id: tenantId,
          tenant_product_id: tenantProductId,
          product_id: productId,
          user_email: email,
          name,
          email,
          subject,
          description,
        }),
      });
      if (!res.ok) {
        setResult({ ok: false, message: 'Failed to generate AI suggestion. Please try again or submit later.' });
      } else {
        const data = (await res.json()) as {
          suggestion: string;
          priority?: string;
        };
        setAiSuggestion(data.suggestion);
        setAiPriority(data.priority || null);
        setStep('review');
        setResult({
          ok: true,
          message: 'Here is an AI-powered suggestion. Let us know if it fixes your issue.',
        });
      }
    } catch {
      setResult({ ok: false, message: 'Network error. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmResolved = () => {
    setStep('done');
    setResult({
      ok: true,
      message: 'Glad it’s resolved! No ticket was created.',
    });
  };

  const handleNeedHuman = async () => {
    if (!subject || !description) return;
    setIsSubmitting(true);
    setResult(null);
    try {
      const res = await fetch(`${API_BASE}/api/widget/tickets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          email,
          subject,
          description,
          source: 'web_form',
          tenant_id: tenantId,
          tenant_product_id: tenantProductId,
          product_id: productId,
          priority: aiPriority,
        }),
      });
      if (!res.ok) {
        setResult({ ok: false, message: 'Failed to submit ticket. Please try again.' });
        return;
      }
      const data = (await res.json()) as {
        ticket_number?: string;
      };
      setStep('done');
      setResult({
        ok: true,
        message:
          data.ticket_number
            ? `Ticket ${data.ticket_number} has been created. A human agent will contact you via email.`
            : 'Thank you! Your request has been submitted to a human agent. They will contact you via email.',
      });
      setName('');
      setEmail('');
      setSubject('');
      setDescription('');
      setAiSuggestion(null);
      setAiPriority(null);
    } catch {
      setResult({ ok: false, message: 'Network error while creating ticket. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0F172A',
        color: '#F9FAFB',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
        padding: '32px 16px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 520,
          background: '#020617',
          borderRadius: 20,
          border: '1px solid rgba(148,163,184,0.35)',
          padding: 24,
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.7)',
        }}
      >
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Submit a support request</h1>
        <p style={{ fontSize: 13, color: '#94A3B8', marginBottom: 20 }}>
          Use this form to reach the support team. First, our AI will suggest a quick fix. If it doesn’t help, we’ll
          raise a ticket to a human agent.
        </p>

        {result && (
          <div
            style={{
              marginBottom: 14,
              padding: 10,
              borderRadius: 10,
              fontSize: 12,
              background: result.ok ? 'rgba(22,163,74,0.15)' : 'rgba(239,68,68,0.15)',
              color: result.ok ? '#4ADE80' : '#FCA5A5',
            }}
          >
            {result.message}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '9px 10px',
                borderRadius: 10,
                border: '1px solid rgba(148,163,184,0.35)',
                background: '#020617',
                color: '#F9FAFB',
                fontSize: 13,
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '9px 10px',
                borderRadius: 10,
                border: '1px solid rgba(148,163,184,0.35)',
                background: '#020617',
                color: '#F9FAFB',
                fontSize: 13,
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Subject</label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '9px 10px',
                borderRadius: 10,
                border: '1px solid rgba(148,163,184,0.35)',
                background: '#020617',
                color: '#F9FAFB',
                fontSize: 13,
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Describe your issue</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              rows={4}
              style={{
                width: '100%',
                padding: '9px 10px',
                borderRadius: 10,
                border: '1px solid rgba(148,163,184,0.35)',
                background: '#020617',
                color: '#F9FAFB',
                fontSize: 13,
                resize: 'vertical',
              }}
            />
          </div>
          {step === 'form' && (
            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                marginTop: 4,
                padding: '10px 18px',
                borderRadius: 999,
                border: 'none',
                background: '#FACC15',
                color: '#0F172A',
                fontWeight: 700,
                fontSize: 13,
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                opacity: isSubmitting ? 0.8 : 1,
              }}
            >
              {isSubmitting ? 'Asking AI…' : 'Submit & get AI suggestion'}
            </button>
          )}
        </form>

        {step === 'review' && aiSuggestion && (
          <div
            style={{
              marginTop: 16,
              padding: 14,
              borderRadius: 12,
              border: '1px solid rgba(148,163,184,0.5)',
              background: '#020617',
              fontSize: 13,
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 6 }}>AI suggested fix</div>
            <p style={{ whiteSpace: 'pre-wrap', marginBottom: 12 }}>{aiSuggestion}</p>
            <div style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 8 }}>
              Did this solve your issue, or do you still need a human agent?
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={handleConfirmResolved}
                style={{
                  padding: '8px 14px',
                  borderRadius: 999,
                  border: 'none',
                  background: '#22C55E',
                  color: '#022C22',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Yes, it’s fixed
              </button>
              <button
                type="button"
                onClick={handleNeedHuman}
                disabled={isSubmitting}
                style={{
                  padding: '8px 14px',
                  borderRadius: 999,
                  border: '1px solid rgba(148,163,184,0.7)',
                  background: 'transparent',
                  color: '#E5E7EB',
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  opacity: isSubmitting ? 0.8 : 1,
                }}
              >
                No, I need a human
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

