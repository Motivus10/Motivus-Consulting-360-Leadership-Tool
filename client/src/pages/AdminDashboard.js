import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

export default function AdminDashboard() {
  const [projects, setProjects] = useState([]);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ subject_name:'', subject_email:'', company:'', deadline:'' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { adminName, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => { loadProjects(); }, []);

  const loadProjects = async () => {
    try { setProjects(await api.getProjects()); } catch {}
  };

  const createProject = async (e) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const { id } = await api.createProject(form);
      navigate(`/admin/projects/${id}`);
    } catch (err) { setError(err.message); setLoading(false); }
  };

  const statusLabel = s => s?.replace(/_/g,' ') || 'setup';

  return (
    <div className="page">
      <div className="topbar">
        <div className="logo">motivus <span>CONSULTING</span> — 360° Admin</div>
        <div className="user">
          <span>{adminName}</span>
          <button onClick={logout}>Sign out</button>
        </div>
      </div>

      <div className="main">
        <div className="card">
          <div className="card-header">
            <h2>360° Projects</h2>
            <button className="btn btn-primary btn-sm" onClick={() => setShowNew(v => !v)}>
              {showNew ? '✕ Cancel' : '+ New Project'}
            </button>
          </div>

          {showNew && (
            <form onSubmit={createProject} style={{ background:'#f9fafb', padding:20, borderRadius:8, marginBottom:20, border:'1px solid #eee' }}>
              <h3 style={{ color:'var(--navy)', marginBottom:16 }}>New 360° Project</h3>
              {error && <div className="alert alert-error">{error}</div>}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div className="form-group">
                  <label>Subject Name *</label>
                  <input required value={form.subject_name} onChange={e => setForm(f=>({...f,subject_name:e.target.value}))} placeholder="e.g. Daniel Thomas" />
                </div>
                <div className="form-group">
                  <label>Subject Email *</label>
                  <input type="email" required value={form.subject_email} onChange={e => setForm(f=>({...f,subject_email:e.target.value}))} placeholder="daniel@company.com" />
                </div>
                <div className="form-group">
                  <label>Company</label>
                  <input value={form.company} onChange={e => setForm(f=>({...f,company:e.target.value}))} placeholder="Company name" />
                </div>
                <div className="form-group">
                  <label>Deadline</label>
                  <input type="date" value={form.deadline} onChange={e => setForm(f=>({...f,deadline:e.target.value}))} />
                </div>
              </div>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Creating…' : 'Create Project'}
              </button>
            </form>
          )}

          {projects.length === 0
            ? <p style={{ color:'var(--slate)', textAlign:'center', padding:'32px 0' }}>No projects yet. Create one above.</p>
            : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Subject</th>
                      <th>Company</th>
                      <th>Status</th>
                      <th>Completion</th>
                      <th>Deadline</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {projects.map(p => (
                      <tr key={p.id}>
                        <td>
                          <strong>{p.subject_name}</strong>
                          <div style={{ fontSize:12, color:'var(--slate)' }}>{p.subject_email}</div>
                        </td>
                        <td>{p.company || '—'}</td>
                        <td><span className={`badge badge-${p.status}`}>{statusLabel(p.status)}</span></td>
                        <td>
                          <span style={{ fontSize:13 }}>
                            {p.submitted_count}/{p.total_raters} submitted
                          </span>
                          <div style={{ background:'#eee', borderRadius:4, height:5, marginTop:4 }}>
                            <div style={{ background:'var(--navy)', borderRadius:4, height:5,
                              width: p.total_raters ? `${(p.submitted_count/p.total_raters)*100}%` : '0%' }} />
                          </div>
                        </td>
                        <td style={{ fontSize:13 }}>{p.deadline ? new Date(p.deadline).toLocaleDateString('en-GB') : '—'}</td>
                        <td>
                          <Link to={`/admin/projects/${p.id}`} className="btn btn-secondary btn-sm">Manage</Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
        </div>
      </div>
    </div>
  );
}
