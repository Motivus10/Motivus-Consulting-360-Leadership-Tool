const BASE = process.env.REACT_APP_API_URL || '';

async function apiFetch(path, options = {}) {
  const token = localStorage.getItem('motivus_token');
  const res = await fetch(BASE + path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export const api = {
  // Admin
  login:        (body)    => apiFetch('/api/admin/login', { method:'POST', body: JSON.stringify(body) }),
  getProjects:  ()        => apiFetch('/api/admin/projects'),
  createProject:(body)    => apiFetch('/api/admin/projects', { method:'POST', body: JSON.stringify(body) }),
  getProject:   (id)      => apiFetch(`/api/admin/projects/${id}`),
  sendNomInvite:(id)      => apiFetch(`/api/admin/projects/${id}/send-nomination-invite`, { method:'POST' }),
  addRater:     (id, body)=> apiFetch(`/api/admin/projects/${id}/raters`, { method:'POST', body: JSON.stringify(body) }),
  deleteRater:  (id)      => apiFetch(`/api/admin/raters/${id}`, { method:'DELETE' }),
  sendInvites:  (id)      => apiFetch(`/api/admin/projects/${id}/send-invites`, { method:'POST' }),
  getResults:   (id)      => apiFetch(`/api/admin/projects/${id}/results`),
  setStatus:    (id, s)   => apiFetch(`/api/admin/projects/${id}/status`, { method:'PATCH', body: JSON.stringify({ status: s }) }),

  // Nominations
  getNomProject:(code)    => apiFetch(`/api/nominate/${code}`),
  submitNoms:   (code, b) => apiFetch(`/api/nominate/${code}`, { method:'POST', body: JSON.stringify(b) }),

  // Survey
  getSurvey:    (code)    => apiFetch(`/api/survey/auth?code=${code}`),
  saveSurvey:   (body)    => apiFetch('/api/survey/save', { method:'POST', body: JSON.stringify(body) }),
  submitSurvey: (code)    => apiFetch('/api/survey/submit', { method:'POST', body: JSON.stringify({ code }) }),
};
