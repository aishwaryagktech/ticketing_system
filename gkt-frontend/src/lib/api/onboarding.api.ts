const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('gkt_token');
}

function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('gkt_refresh_token');
}

function authHeaders(): HeadersInit {
  const token = getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function refreshAccessToken(): Promise<string | null> {
  const refresh_token = getRefreshToken();
  if (!refresh_token) return null;
  const res = await fetch(`${API_BASE}/api/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.token) return null;
  localStorage.setItem('gkt_token', data.token);
  return data.token as string;
}

async function fetchWithAuthRetry(url: string, init?: RequestInit): Promise<Response> {
  const first = await fetch(url, { ...init, headers: { ...(init?.headers || {}), ...authHeaders() } });
  if (first.status !== 401) return first;

  const newToken = await refreshAccessToken();
  if (!newToken) return first;

  return fetch(url, {
    ...init,
    headers: {
      ...(init?.headers || {}),
      'Content-Type': 'application/json',
      Authorization: `Bearer ${newToken}`,
    },
  });
}

export const onboardingApi = {
  getState: () =>
    fetchWithAuthRetry(`${API_BASE}/api/onboarding`).then((r) => {
      if (!r.ok) throw new Error('Failed to load onboarding');
      return r.json();
    }),
  setPlan: (plan_id: string) =>
    fetchWithAuthRetry(`${API_BASE}/api/onboarding/plan`, {
      method: 'PATCH',
      body: JSON.stringify({ plan_id }),
    }).then((r) => {
      if (!r.ok) throw new Error('Failed to set plan');
      return r.json();
    }),
  setStep: (step: string) =>
    fetchWithAuthRetry(`${API_BASE}/api/onboarding/step`, {
      method: 'PATCH',
      body: JSON.stringify({ step }),
    }).then((r) => {
      if (!r.ok) throw new Error('Failed to update step');
      return r.json();
    }),
  getProducts: () =>
    fetchWithAuthRetry(`${API_BASE}/api/onboarding/products`).then((r) => {
      if (!r.ok) throw new Error('Failed to list products');
      return r.json();
    }),
  createProduct: (data: { name: string; description?: string; status?: string }) =>
    fetchWithAuthRetry(`${API_BASE}/api/onboarding/products`, {
      method: 'POST',
      body: JSON.stringify(data),
    }).then((r) => {
      if (!r.ok) throw new Error('Failed to create product');
      return r.json();
    }),
  getAgents: () =>
    fetchWithAuthRetry(`${API_BASE}/api/onboarding/agents`).then((r) => {
      if (!r.ok) throw new Error('Failed to list agents');
      return r.json();
    }),
  inviteAgent: (data: {
    name: string;
    email: string;
    role?: string;
    assigned_products?: string[];
    support_level?: string;
  }) =>
    fetchWithAuthRetry(`${API_BASE}/api/onboarding/agents`, {
      method: 'POST',
      body: JSON.stringify(data),
    }).then((r) => {
      if (!r.ok) throw new Error('Failed to invite agent');
      return r.json();
    }),
  putTicketSettings: (data: {
    ticket_prefix?: string;
    default_priority?: string;
    categories?: string[];
    attachment_limit_mb?: number;
    assignment_rule?: string;
  }) =>
    fetchWithAuthRetry(`${API_BASE}/api/onboarding/ticket-settings`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }).then((r) => {
      if (!r.ok) throw new Error('Failed to save ticket settings');
      return r.json();
    }),
  putSla: (policies: Array<{ priority: 'p1' | 'p2' | 'p3' | 'p4'; response_time_mins: number; resolution_time_mins: number; warning_threshold_pct?: number }>) =>
    fetchWithAuthRetry(`${API_BASE}/api/onboarding/sla`, {
      method: 'PUT',
      body: JSON.stringify({ policies }),
    }).then((r) => {
      return r.json().catch(() => ({})).then((data) => {
        if (!r.ok) {
          const msg = (data && (data.error || data.message)) ? String(data.error || data.message) : 'Failed to save SLA';
          throw new Error(msg);
        }
        return data;
      });
    }),
  getSla: () =>
    fetchWithAuthRetry(`${API_BASE}/api/onboarding/sla`).then((r) => {
      return r.json().catch(() => ([])).then((data) => {
        if (!r.ok) {
          const msg = (data && (data.error || data.message)) ? String(data.error || data.message) : 'Failed to load SLA';
          throw new Error(msg);
        }
        return data;
      });
    }),
  getEscalation: () =>
    fetchWithAuthRetry(`${API_BASE}/api/onboarding/escalation`).then((r) => {
      return r.json().catch(() => ([])).then((data) => {
        if (!r.ok) {
          const msg = (data && (data.error || data.message)) ? String(data.error || data.message) : 'Failed to load escalation rules';
          throw new Error(msg);
        }
        return data;
      });
    }),
  getChannels: () =>
    fetchWithAuthRetry(`${API_BASE}/api/onboarding/channels`).then((r) =>
      r
        .json()
        .catch(() => (null))
        .then((data) => {
          if (!r.ok) throw new Error(String((data as any)?.error || 'Failed to load channel settings'));
          return data;
        })
    ),
  putChannels: (data: {
    chat_enabled?: boolean;
    chat_position?: string;
    chat_primary_color?: string;
    webform_enabled?: boolean;
    webform_path?: string;
    email_enabled?: boolean;
    support_email?: string | null;
    default_product_id?: string | null;
  }) =>
    fetchWithAuthRetry(`${API_BASE}/api/onboarding/channels`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }).then((r) =>
      r
        .json()
        .catch(() => ({}))
        .then((resp) => {
          if (!r.ok) throw new Error(String((resp as any)?.error || 'Failed to save channel settings'));
          return resp;
        })
    ),
  putEscalation: (rules: any[]) =>
    fetchWithAuthRetry(`${API_BASE}/api/onboarding/escalation`, {
      method: 'PUT',
      body: JSON.stringify({ rules }),
    }).then((r) => {
      return r.json().catch(() => ({})).then((data) => {
        if (!r.ok) {
          const msg = (data && (data.error || data.message)) ? String(data.error || data.message) : 'Failed to save escalation rules';
          throw new Error(msg);
        }
        return data;
      });
    }),
  seedRewireStarterKb: () =>
    fetchWithAuthRetry(`${API_BASE}/api/onboarding/kb/seed-rewire-starter`, {
      method: 'POST',
      body: JSON.stringify({}),
    }).then((r) => {
      return r.json().catch(() => ({})).then((data) => {
        if (!r.ok) {
          const msg = (data && (data.error || data.message)) ? String(data.error || data.message) : 'Failed to seed KB';
          throw new Error(msg);
        }
        return data;
      });
    }),
  kbCrawl: (url: string, tenant_product_id?: string) =>
    fetchWithAuthRetry(`${API_BASE}/api/onboarding/kb/crawl`, {
      method: 'POST',
      body: JSON.stringify({ url, tenant_product_id }),
    }).then((r) =>
      r.json().catch(() => ({})).then((data) => {
        if (!r.ok) throw new Error(String(data?.error || 'Failed to crawl'));
        return data;
      })
    ),
  kbSources: (tenant_product_id?: string) =>
    fetchWithAuthRetry(`${API_BASE}/api/onboarding/kb/sources${tenant_product_id ? `?tenant_product_id=${encodeURIComponent(tenant_product_id)}` : ''}`).then((r) =>
      r.json().catch(() => ([])).then((data) => {
        if (!r.ok) throw new Error(String(data?.error || 'Failed to load sources'));
        return data;
      })
    ),
  kbSource: (id: string) =>
    fetchWithAuthRetry(`${API_BASE}/api/onboarding/kb/sources/${id}`).then((r) =>
      r.json().catch(() => ({})).then((data) => {
        if (!r.ok) throw new Error(String(data?.error || 'Failed to load source'));
        return data;
      })
    ),
  kbConvert: (id: string, data: { title: string; body: string; category: string; audience: string; tags: string[]; is_published?: boolean; tenant_product_id?: string | null }) =>
    fetchWithAuthRetry(`${API_BASE}/api/onboarding/kb/sources/${id}/convert`, {
      method: 'POST',
      body: JSON.stringify(data),
    }).then((r) =>
      r.json().catch(() => ({})).then((resp) => {
        if (!r.ok) throw new Error(String(resp?.error || 'Failed to create article'));
        return resp;
      })
    ),
  kbDeleteSource: (id: string) =>
    fetchWithAuthRetry(`${API_BASE}/api/onboarding/kb/sources/${id}`, { method: 'DELETE' }).then((r) =>
      r.json().catch(() => ({})).then((data) => {
        if (!r.ok) throw new Error(String(data?.error || 'Failed to delete source'));
        return data;
      })
    ),
  kbDeleteArticle: (id: string) =>
    fetchWithAuthRetry(`${API_BASE}/api/onboarding/kb/articles/${id}`, { method: 'DELETE' }).then((r) =>
      r.json().catch(() => ({})).then((data) => {
        if (!r.ok) throw new Error(String(data?.error || 'Failed to delete article'));
        return data;
      })
    ),
  kbUpload: async (file: File, tenant_product_id?: string) => {
    const token = localStorage.getItem('gkt_token');
    const form = new FormData();
    form.append('file', file);
    if (tenant_product_id) form.append('tenant_product_id', tenant_product_id);
    const res = await fetch(`${API_BASE}/api/onboarding/kb/upload`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: form,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(String((data as any)?.error || 'Failed to upload'));
    return data;
  },
  kbArticles: (tenant_product_id?: string) =>
    fetchWithAuthRetry(`${API_BASE}/api/onboarding/kb/articles${tenant_product_id ? `?tenant_product_id=${encodeURIComponent(tenant_product_id)}` : ''}`).then((r) =>
      r.json().catch(() => ([])).then((data) => {
        if (!r.ok) throw new Error(String(data?.error || 'Failed to load articles'));
        return data;
      })
    ),
  aiModels: () =>
    fetchWithAuthRetry(`${API_BASE}/api/onboarding/ai/models`).then((r) =>
      r.json().catch(() => ({})).then((data) => {
        if (!r.ok) throw new Error(String(data?.error || 'Failed to load models'));
        return data;
      })
    ),
  setL0Model: (tenant_product_id: string, provider_name: string, model: string) =>
    fetchWithAuthRetry(`${API_BASE}/api/onboarding/ai/l0-model`, {
      method: 'PUT',
      body: JSON.stringify({ tenant_product_id, provider_name, model }),
    }).then((r) =>
      r.json().catch(() => ({})).then((data) => {
        if (!r.ok) throw new Error(String(data?.error || 'Failed to save model'));
        return data;
      })
    ),
  getBranding: () =>
    fetchWithAuthRetry(`${API_BASE}/api/onboarding/branding`).then((r) =>
      r
        .json()
        .catch(() => ({}))
        .then((data) => {
          if (!r.ok) throw new Error(String((data as any)?.error || 'Failed to load branding'));
          return data;
        })
    ),
  putBranding: (data: { logo_base64?: string | null; primary_color?: string; custom_domain?: string | null }) =>
    fetchWithAuthRetry(`${API_BASE}/api/onboarding/branding`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }).then((r) =>
      r
        .json()
        .catch(() => ({}))
        .then((resp) => {
          if (!r.ok) throw new Error(String((resp as any)?.error || 'Failed to save branding'));
          return resp;
        })
    ),
};
