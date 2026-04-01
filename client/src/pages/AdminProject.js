import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api';

const GROUPS = [
  { name: 'Manager', min: 1, max: 1 },
  { name: 'Peers', min: 3, max: 8 },
  { name: 'Team Members', min: 3, max: 8 },
  { name: 'Other Stakeholders', min: 1, max: 8 },
];

export default function AdminProject() {
  const { id } = useParams();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [msgType, setMsgType] = useState('success');
  const [adding, setAdding] = useState({});
  const [addForm, setAddForm] = useState({});

  const notify = (m, t='success') => { setMsg(m); setMsgType(t); setTimeout(() => setMsg(''), 4000); };

  const load = async () => {
    setLoading(true);
    try { const data = await api.getProject(id); setProject(data); }
    catch(e) { notify(e.message, 'error'); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  const startAdding = (g) => setAdding(p => ({...p, [g]: true}));
  const cancelAdding = (g) => setAdding(p => ({...p, [g]: false}));

  const addRater = async (e, groupName) => {
    e.preventDefault();
    const form = addForm[groupName] || {};
    if (!form.email || !form.name) { notify('Email and name are required', 'error'); return; }
    try {
      await api.addRater(id, { email: form.email, name: form.name, group_type: groupName });
      notify('Rater added');
      setAdding(p => ({...p, [groupName]: false}));
      load();
    } catch(e) { notify(e.message, 'error'); }
  };

  const deleteRater = async (rid) => {
    if (!window.confirm('Remove this rater?')) return;
    try { await api.deleteRater(rid); notify('Removed'); load(); }
    catch(e) { notify(e.message, 'error'); }
  };

  const sendInvites = async () => {
    try { const r = await api.sendInvites(id); notify(r.sent + ' invite(s) sent'); load(); }
    catch(e) { notify(e.message, 'error'); }
  };

  if (loading) return <div className="page"><div className="main"><p>Loading...</p></div></div>;
  if (!project) return null;

  const byGroup = {};
  GROUPS.forEach(g => { byGroup[g.name] = []; });
  project.raters?.forEach(r => { if (byGroup[r.group_type] !== undefined) byGroup[r.group_type].push(r); });

  const total = project.raters?.length || 0;
  const submitted = project.raters?.filter(r => r.status === 'submitted').length || 0;

  return (
    <div className="page">
      <div className="topbar">
        <div className="logo">motivus <span>CONSULTING</span></div>
        <div className="user"><Link to="/admin" style={{color:"var(--light-blue)",textDecoration:"none",fontSize:14}}>← Dashboard</Link></div>
      </div>
      <div className="main">
        {msg && <div className={"alert alert-" + (msgType==="error"?"danger":"success")}>{msg}</div>}
        <div style={{background:"white",borderRadius:8,padding:24,marginBottom:24,boxShadow:"0 2px 8px rgba(0,0,0,0.08)"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
            <div>
              <h2 style={{margin:0,color:"var(--navy)"}}>{project.subject_name}</h2>
              <p style={{margin:"4px 0 0",color:"var(--slate)",fontSize:14}}>{project.subject_email} · {project.company} · Deadline: {new Date(project.deadline).toLocaleDateString("en-GB")}</p>
            </div>
            <span className={"badge " + (project.status==="active"?"badge-success":"badge-secondary")}>{project.status}</span>
          </div>
          <div style={{marginTop:16,paddingTop:16,borderTop:"1px solid #eee",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span style={{color:"var(--slate)",fontSize:14}}>Feedback completion: {submitted}/{total} submitted</span>
            <button className="btn btn-primary btn-sm" onClick={sendInvites}>Send All Invites</button>
          </div>
        </div>

        {GROUPS.map(group => {
          const raters = byGroup[group.name];
          const form = addForm[group.name] || {email:"",name:""};
          return (
            <div key={group.name} style={{background:"white",borderRadius:8,padding:24,marginBottom:16,boxShadow:"0 2px 8px rgba(0,0,0,0.08)"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                <div>
                  <h3 style={{margin:0,color:"var(--navy)"}}>{group.name}</h3>
                  <span style={{fontSize:12,color:"var(--slate)"}}>{raters.length} added · {group.min}–{group.max} required</span>
                </div>
                {raters.length < group.max && !adding[group.name] && (
                  <button className="btn btn-primary btn-sm" onClick={() => startAdding(group.name)}>+ Add Rater</button>
                )}
              </div>
              {adding[group.name] && (
                <form onSubmit={e => addRater(e, group.name)} style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
                  <input className="form-control" style={{flex:1,minWidth:180}} type="email" placeholder="Email *" required
                    value={form.email} onChange={e => setAddForm(p => ({...p, [group.name]:{...p[group.name],email:e.target.value}}))} />
                  <input className="form-control" style={{flex:1,minWidth:150}} type="text" placeholder="Full name *" required
                    value={form.name} onChange={e => setAddForm(p => ({...p, [group.name]:{...p[group.name],name:e.target.value}}))} />
                  <button className="btn btn-primary btn-sm" type="submit">Add</button>
                  <button className="btn btn-secondary btn-sm" type="button" onClick={() => cancelAdding(group.name)}>Cancel</button>
                </form>
              )}
              {raters.length === 0
                ? <p style={{color:"var(--slate)",fontSize:14,margin:0}}>No raters added yet.</p>
                : <table className="table table-sm" style={{margin:0}}>
                    <thead><tr><th>Name</th><th>Email</th><th>Status</th><th>Invited</th><th></th></tr></thead>
                    <tbody>{raters.map(r => (
                      <tr key={r.id}>
                        <td>{r.name}</td>
                        <td style={{fontSize:13}}>{r.email}</td>
                        <td><span className={"badge "+(r.status==="submitted"?"badge-success":"badge-secondary")}>{r.status||"pending"}</span></td>
                        <td style={{fontSize:12,color:"var(--slate)"}}>{r.invited_at ? "✓ "+new Date(r.invited_at).toLocaleDateString("en-GB") : "–"}</td>
                        <td><button className="btn btn-danger btn-sm" onClick={() => deleteRater(r.id)}>Remove</button></td>
                      </tr>
                    ))}</tbody>
                  </table>
              }
            </div>
          );
        })}
      </div>
    </div>
  );
}
