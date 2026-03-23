import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api';

const GROUPS = [
  { name:'Manager',       min:1, max:1, desc:'Your direct line manager' },
  { name:'Peers',         min:3, max:8, desc:'Colleagues at a similar level who work closely with you' },
  { name:'Team Members',  min:3, max:8, desc:'People who report to you or you lead' },
  { name:'Stakeholders',  min:0, max:8, desc:'Key stakeholders you work with (optional)' },
];

export default function Nominate() {
  const [params] = useSearchParams();
  const code = params.get('code');
  const [project, setProject] = useState(null);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // nominations: { groupName: [{name, email}] }
  const [nominations, setNominations] = useState(() => {
    const init = {};
    GROUPS.forEach(g => { init[g.name] = [{ name:'', email:'' }]; });
    return init;
  });

  useEffect(() => {
    if (!code) { setError('No access code provided.'); setLoading(false); return; }
    api.getNomProject(code)
      .then(p => {
        if (p.nomination_submitted) setSubmitted(true);
        setProject(p);
      })
      .catch(() => setError('Invalid or expired code.'))
      .finally(() => setLoading(false));
  }, [code]);

  const addRow = (groupName) => {
    setNominations(n => ({ ...n, [groupName]: [...n[groupName], { name:'', email:'' }] }));
  };

  const removeRow = (groupName, idx) => {
    setNominations(n => ({ ...n, [groupName]: n[groupName].filter((_, i) => i !== idx) }));
  };

  const updateRow = (groupName, idx, field, value) => {
    setNominations(n => {
      const rows = [...n[groupName]];
      rows[idx] = { ...rows[idx], [field]: value };
      return { ...n, [groupName]: rows };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); setError('');

    // Validate
    for (const g of GROUPS) {
      const rows = nominations[g.name].filter(r => r.email.trim());
      if (rows.length < g.min) {
        setError(`Please add at least ${g.min} ${g.name}.`); return;
      }
    }

    // Build flat list
    const flat = [];
    GROUPS.forEach(g => {
      nominations[g.name].forEach(r => {
        if (r.email.trim()) flat.push({ group_name: g.name, email: r.email.trim(), name: r.name.trim() || null });
      });
    });

    setSaving(true);
    try {
      await api.submitNoms(code, { nominations: flat });
      setSubmitted(true);
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  if (loading) return <Loading />;

  if (error && !project) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--light-grey)' }}>
      <div className="card" style={{ maxWidth:480, textAlign:'center' }}>
        <div style={{ fontSize:48 }}>⚠️</div>
        <h2 style={{ color:'var(--navy)', margin:'16px 0 8px' }}>Link not found</h2>
        <p style={{ color:'var(--slate)' }}>{error}</p>
      </div>
    </div>
  );

  if (submitted) return (
    <div className="survey-page">
      <Header />
      <div className="survey-body">
        <div className="card completion-card">
          <div className="icon">✅</div>
          <h2>Nominations submitted!</h2>
          <p>Thank you, {project?.subject_name}. Motivus Consulting will review your nominations and send invites to your chosen colleagues.</p>
          <p style={{ marginTop:12 }}>You don't need to do anything else at this stage.</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="survey-page">
      <Header />
      <div className="survey-body">
        <div className="card" style={{ marginBottom:20 }}>
          <h2 style={{ color:'var(--navy)', marginBottom:8 }}>Your 360° Feedback Nominations</h2>
          <p style={{ color:'var(--slate)', fontSize:14, lineHeight:1.6 }}>
            Hi <strong>{project?.subject_name}</strong>, please nominate the colleagues you'd like to provide feedback on your leadership.
            All responses will be <strong>completely anonymous</strong> — only group averages will be shown in your report.
          </p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          {GROUPS.map(g => (
            <div key={g.name} className="nom-group">
              <div className="nom-group-header">
                {g.name}
                <span style={{ fontWeight:400, fontSize:12, marginLeft:8 }}>
                  ({g.min === 0 ? 'optional' : `min ${g.min}`}, max {g.max})
                  {' — '}{g.desc}
                </span>
              </div>
              <div className="nom-group-body">
                {nominations[g.name].map((row, idx) => (
                  <div key={idx} className="nom-entry">
                    <input style={{ flex:1 }} placeholder="First & last name (optional)"
                      value={row.name} onChange={e => updateRow(g.name, idx, 'name', e.target.value)} />
                    <input style={{ flex:1.5 }} type="email" placeholder="Email address *"
                      value={row.email} onChange={e => updateRow(g.name, idx, 'email', e.target.value)}
                      required={idx < g.min} />
                    {nominations[g.name].length > (g.min === 0 ? 1 : 1) && (
                      <button type="button" className="btn btn-danger btn-sm" onClick={() => removeRow(g.name, idx)}>✕</button>
                    )}
                  </div>
                ))}
                {nominations[g.name].length < g.max && (
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => addRow(g.name)}>
                    + Add another {g.name.slice(0,-1)}
                  </button>
                )}
              </div>
            </div>
          ))}

          <div style={{ textAlign:'center', marginTop:24 }}>
            <button type="submit" className="btn btn-primary" style={{ minWidth:200 }} disabled={saving}>
              {saving ? 'Submitting…' : 'Submit Nominations'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Header() {
  return (
    <div className="survey-header">
      <div className="logo">motivus <span>CONSULTING</span> — 360° Feedback</div>
    </div>
  );
}

function Loading() {
  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <p style={{ color:'var(--slate)' }}>Loading…</p>
    </div>
  );
}
