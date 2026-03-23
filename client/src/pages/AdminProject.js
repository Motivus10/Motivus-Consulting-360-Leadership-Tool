import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api';

const GROUPS = ['Self', 'Manager', 'Peers', 'Team Members', 'Stakeholders'];

export default function AdminProject() {
  const { id } = useParams();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [msgType, setMsgType] = useState('success');
  const [addForm, setAddForm] = useState({ email:'', name:'', group_id:'' });
  const [adding, setAdding] = useState(false);

  useEffect(() => { load(); }, [id]);

  const load = async () => {
    setLoading(true);
    try { setProject(await api.getProject(id)); }
    catch (e) { notify(e.message, 'error'); }
    finally { setLoading(false); }
  };

  const notify = (m, t='success') => { setMsg(m); setMsgType(t); setTimeout(() => setMsg(''), 4000); };

  const sendNomInvite = async () => {
    try {
      await api.sendNomInvite(id);
      notify('Nomination invite sent to ' + project.subject_email);
      load();
    } catch (e) { notify(e.message, 'error'); }
  };

  const sendInvites = async () => {
    try {
      const r = await api.sendInvites(id);
      notify(`${r.sent} invite(s) sent`);
      load();
    } catch (e) { notify(e.message, 'error'); }
  };

  const addRater = async (e) => {
    e.preventDefault(); setAdding(true);
    try {
      const r = await api.addRater(id, addForm);
      notify(`Rater added. Access code: ${r.access_code}`);
      setAddForm({ email:'', name:'', group_id: addForm.group_id });
      load();
    } catch (e) { notify(e.message, 'error'); }
    finally { setAdding(false); }
  };

  const deleteRater = async (raterId, email) => {
    if (!window.confirm(`Remove ${email}?`)) return;
    try { await api.deleteRater(raterId); load(); }
    catch (e) { notify(e.message, 'error'); }
  };

  if (loading) return <div className="page"><div className="main"><p>Loading…</p></div></div>;
  if (!project) return null;

  const byGroup = {};
  GROUPS.forEach(g => { byGroup[g] = { group: project.groups?.find(gr => gr.name === g), raters: [] }; });
  project.raters?.forEach(r => {
    if (byGroup[r.group_name]) byGroup[r.group_name].raters.push(r);
  });

  const totalRaters   = project.raters?.length || 0;
  const submitted     = project.raters?.filter(r => r.status === 'submitted').length || 0;
  const allSubmitted  = totalRaters > 0 && totalRaters === submitted;
  const nomLink = `${window.location.origin}/nominate?code=${project.nomination_code}`;

  return (
    <div className="page">
      <div className="topbar">
        <div className="logo">motivus <span>CONSULTING</span></div>
        <div className="user">
          <Link to="/admin" style={{ color:'var(--light-blue)', textDecoration:'none', fontSize:14 }}>← Dashboard</Link>
        </div>
      </div>

      <div className="main">
        {msg && <div className={`alert alert-${msgType}`}>{msg}</div>}

        {/* Project header */}
        <div className="card">
          <div className="card-header">
            <div>
              <h2>{project.subject_name}</h2>
              <p style={{ color:'var(--slate)', fontSize:13, marginTop:4 }}>
                {project.subject_email} {project.company && `· ${project.company}`}
                {project.deadline && ` · Deadline: ${new Date(project.deadline).toLocaleDateString('en-GB')}`}
              </p>
            </div>
            <span className={`badge badge-${project.status}`}>{project.status?.replace(/_/g,' ')}</span>
          </div>

          {/* Progress bar */}
          <div style={{ display:'flex', gap:24, alignItems:'center' }}>
            <div style={{ flex:1 }}>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, marginBottom:6 }}>
                <span style={{ color:'var(--slate)' }}>Feedback completion</span>
                <strong>{submitted}/{totalRaters} submitted</strong>
              </div>
              <div style={{ background:'#eee', borderRadius:6, height:8 }}>
                <div style={{ background: allSubmitted ? 'var(--green)' : 'var(--navy)', borderRadius:6, height:8,
                  width: totalRaters ? `${(submitted/totalRaters)*100}%` : '0%', transition:'width 0.4s' }} />
              </div>
            </div>

            <div style={{ display:'flex', gap:8, flexShrink:0, flexWrap:'wrap' }}>
              {project.status === 'setup' && (
                <button className="btn btn-primary btn-sm" onClick={sendNomInvite}>
                  📧 Send Nomination Invite
                </button>
              )}
              {(project.status === 'nominations_open' || project.status === 'setup') && (
                <button className="btn btn-secondary btn-sm" onClick={() => navigator.clipboard.writeText(nomLink).then(() => notify('Link copied'))}>
                  📋 Copy Nomination Link
                </button>
              )}
              {totalRaters > 0 && (
                <button className="btn btn-primary btn-sm" onClick={sendInvites}>
                  📨 Send Rater Invites
                </button>
              )}
              {(project.status === 'complete' || submitted > 0) && (
                <Link to={`/admin/projects/${id}/results`} className="btn btn-success btn-sm">
                  📊 View Results
                </Link>
              )}
            </div>
          </div>

          {/* Nominations panel */}
          {project.nominations?.length > 0 && (
            <div style={{ marginTop:20, padding:16, background:'#f9fafb', borderRadius:8, border:'1px solid #eee' }}>
              <h4 style={{ color:'var(--navy)', marginBottom:10 }}>📋 Submitted Nominations ({project.nominations.length})</h4>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Group</th><th>Name</th><th>Email</th><th>Action</th></tr></thead>
                  <tbody>
                    {project.nominations.map(n => {
                      const grp = project.groups?.find(g => g.name === n.group_name);
                      const alreadyAdded = project.raters?.some(r => r.email === n.email);
                      return (
                        <tr key={n.id}>
                          <td>{n.group_name}</td>
                          <td>{n.name || '—'}</td>
                          <td>{n.email}</td>
                          <td>
                            {alreadyAdded
                              ? <span style={{ color:'var(--green)', fontSize:12 }}>✓ Added</span>
                              : <button className="btn btn-secondary btn-sm" onClick={async () => {
                                  if (!grp) return notify('Group not found','error');
                                  await api.addRater(id, { email:n.email, name:n.name, group_id:grp.id });
                                  notify(`${n.email} added`); load();
                                }}>Add to Project</button>
                            }
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Rater management */}
        <div className="card">
          <div className="card-header">
            <h2>Raters</h2>
          </div>

          {/* Add rater form */}
          <form onSubmit={addRater} style={{ display:'flex', gap:10, marginBottom:20, flexWrap:'wrap', alignItems:'flex-end' }}>
            <div className="form-group" style={{ flex:1, minWidth:160, marginBottom:0 }}>
              <label>Email *</label>
              <input type="email" required value={addForm.email} onChange={e => setAddForm(f=>({...f,email:e.target.value}))} placeholder="rater@company.com" />
            </div>
            <div className="form-group" style={{ flex:1, minWidth:130, marginBottom:0 }}>
              <label>Name (optional)</label>
              <input value={addForm.name} onChange={e => setAddForm(f=>({...f,name:e.target.value}))} placeholder="First name" />
            </div>
            <div className="form-group" style={{ flex:1, minWidth:160, marginBottom:0 }}>
              <label>Group *</label>
              <select required value={addForm.group_id} onChange={e => setAddForm(f=>({...f,group_id:e.target.value}))}>
                <option value="">Select group…</option>
                {project.groups?.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
            <button type="submit" className="btn btn-primary" disabled={adding} style={{ marginBottom:0 }}>
              {adding ? '…' : '+ Add Rater'}
            </button>
          </form>

          {/* Raters by group */}
          {GROUPS.map(groupName => {
            const { raters } = byGroup[groupName] || {};
            if (!raters?.length) return null;
            return (
              <div key={groupName} style={{ marginBottom:20 }}>
                <h4 style={{ color:'var(--navy)', fontSize:14, marginBottom:8,
                  paddingBottom:6, borderBottom:'1px solid #eee' }}>{groupName}</h4>
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Name</th><th>Email</th><th>Access Code</th><th>Status</th><th>Invited</th><th></th></tr></thead>
                    <tbody>
                      {raters.map(r => (
                        <tr key={r.id}>
                          <td>{r.name || '—'}</td>
                          <td>{r.email}</td>
                          <td>
                            <code style={{ background:'#f0f4ff', padding:'2px 8px', borderRadius:4,
                              fontSize:13, fontWeight:700, letterSpacing:2 }}>{r.access_code}</code>
                          </td>
                          <td><span className={`badge badge-${r.status}`}>{r.status}</span></td>
                          <td style={{ fontSize:12, color:'var(--slate)' }}>
                            {r.invite_sent ? `✓ ${new Date(r.invite_sent_at).toLocaleDateString('en-GB')}` : '—'}
                          </td>
                          <td>
                            <button className="btn btn-danger btn-sm" onClick={() => deleteRater(r.id, r.email)}>Remove</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}

          {totalRaters === 0 && (
            <p style={{ color:'var(--slate)', textAlign:'center', padding:'24px 0' }}>
              No raters added yet. Add them manually above or send a nomination invite to the subject.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
