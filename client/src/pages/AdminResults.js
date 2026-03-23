import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api';

const GROUP_ORDER = ['Self', 'Manager', 'Peers', 'Team Members', 'Stakeholders'];
const GROUP_COLORS = { 'Self':'var(--self)', 'Manager':'var(--manager)', 'Peers':'var(--peers)', 'Team Members':'var(--team)', 'Stakeholders':'var(--stakeholder)' };

function ScoreBar({ score, max=6 }) {
  if (!score) return <span style={{ color:'#aaa', fontSize:12 }}>N/A</span>;
  const pct = (score / max) * 100;
  const col = score >= 4 ? 'var(--green)' : score >= 3 ? 'var(--self)' : 'var(--red)';
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
      <div style={{ flex:1, background:'#eee', borderRadius:4, height:8 }}>
        <div style={{ background:col, borderRadius:4, height:8, width:`${pct}%`, transition:'width 0.4s' }} />
      </div>
      <strong style={{ fontSize:14, color:'var(--navy)', minWidth:26, textAlign:'right' }}>{score}</strong>
    </div>
  );
}

export default function AdminResults() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState(null);
  const [activeTab, setActiveTab] = useState('scores');

  useEffect(() => {
    api.getResults(id)
      .then(d => { setData(d); setActiveSection(Object.keys(groupBySection(d.scores))[0]); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="page"><div className="main"><p>Loading results…</p></div></div>;
  if (!data) return null;

  function groupBySection(scores) {
    const sections = {};
    scores.forEach(s => {
      if (!sections[s.section]) sections[s.section] = { title: s.section_title, questions: {} };
      if (!sections[s.section].questions[s.question_id])
        sections[s.section].questions[s.question_id] = { text: s.question_text, num: s.question_number, groups: {} };
      sections[s.section].questions[s.question_id].groups[s.group_name] = s;
    });
    return sections;
  }

  function groupConstraints(constraints) {
    const out = {};
    constraints.forEach(c => {
      const key = `${c.section}_${c.id}`;
      if (!out[key]) out[key] = { section: c.section, type: c.item_type, text: c.item_text, groups: {} };
      out[key].groups[c.group_name] = c;
    });
    return Object.values(out);
  }

  const sections = groupBySection(data.scores);
  const sectionKeys = Object.keys(sections);
  const constraints = groupConstraints(data.constraints);

  const tabStyle = (t) => ({
    padding: '8px 20px', border: 'none', background: activeTab===t ? 'var(--navy)' : '#eee',
    color: activeTab===t ? 'white' : 'var(--dark-grey)', cursor:'pointer', borderRadius:'6px 6px 0 0',
    fontWeight:600, fontSize:14,
  });

  return (
    <div className="page">
      <div className="topbar">
        <div className="logo">motivus <span>CONSULTING</span></div>
        <div className="user">
          <Link to={`/admin/projects/${id}`} style={{ color:'var(--light-blue)', textDecoration:'none', fontSize:14 }}>← Project</Link>
        </div>
      </div>
      <div className="main">
        <div className="card">
          <div className="card-header">
            <div>
              <h2>Results: {data.project.subject_name}</h2>
              <p style={{ color:'var(--slate)', fontSize:13, marginTop:4 }}>{data.project.company}</p>
            </div>
            <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
              {data.completion.map(c => (
                <div key={c.group_name} style={{ fontSize:12, textAlign:'center' }}>
                  <div className={`group-pill pill-${c.group_name}`}>{c.group_name}</div>
                  <div style={{ color:'var(--slate)', marginTop:2 }}>{c.submitted}/{c.total}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display:'flex', gap:4, marginBottom:-1, borderBottom:'2px solid var(--navy)' }}>
            {['scores','constraints','comments'].map(t => (
              <button key={t} style={tabStyle(t)} onClick={() => setActiveTab(t)}>
                {t === 'scores' ? '📊 Scores' : t === 'constraints' ? '⚠️ Constraints & Risks' : '💬 Comments'}
              </button>
            ))}
          </div>

          <div style={{ paddingTop:20 }}>

            {/* SCORES TAB */}
            {activeTab === 'scores' && (
              <div style={{ display:'flex', gap:0 }}>
                {/* Section nav */}
                <div style={{ width:200, flexShrink:0, borderRight:'1px solid #eee', marginRight:24, paddingRight:16 }}>
                  {sectionKeys.map(k => (
                    <button key={k} onClick={() => setActiveSection(k)} style={{
                      display:'block', width:'100%', textAlign:'left', padding:'8px 12px',
                      background: activeSection===k ? 'var(--light-grey)' : 'transparent',
                      border:'none', borderRadius:6, cursor:'pointer', fontSize:13,
                      color: activeSection===k ? 'var(--navy)' : 'var(--dark-grey)',
                      fontWeight: activeSection===k ? 700 : 400, marginBottom:4,
                    }}>{sections[k].title}</button>
                  ))}
                </div>

                {/* Question scores */}
                <div style={{ flex:1 }}>
                  {activeSection && sections[activeSection] && (
                    <>
                      <h3 style={{ color:'var(--navy)', marginBottom:16 }}>{sections[activeSection].title}</h3>
                      {Object.values(sections[activeSection].questions).map(q => (
                        <div key={q.num} style={{ marginBottom:20, padding:16, background:'var(--light-grey)', borderRadius:8 }}>
                          <p style={{ fontSize:14, fontWeight:600, marginBottom:12, color:'var(--dark-grey)' }}>
                            {q.num}. {q.text}
                          </p>
                          {GROUP_ORDER.map(gName => {
                            const g = q.groups[gName];
                            if (!g || (g.rated_count === 0 && g.cannot_say_count === 0)) return null;
                            const csTotal = g.rated_count + g.cannot_say_count;
                            const csPct = csTotal > 0 ? Math.round((g.cannot_say_count / csTotal) * 100) : 0;
                            return (
                              <div key={gName} style={{ display:'flex', alignItems:'center', gap:12, marginBottom:8 }}>
                                <div style={{ width:100, fontSize:12, color: GROUP_COLORS[gName], fontWeight:600 }}>{gName}</div>
                                <div style={{ flex:1 }}><ScoreBar score={g.avg_score} /></div>
                                {g.min_score && g.max_score && (
                                  <div style={{ fontSize:11, color:'var(--slate)', minWidth:50 }}>
                                    {g.min_score}–{g.max_score}
                                  </div>
                                )}
                                {csPct > 0 && (
                                  <div style={{ fontSize:11, color:'var(--slate)', minWidth:60 }}>
                                    {csPct}% N/A
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </div>
            )}

            {/* CONSTRAINTS TAB */}
            {activeTab === 'constraints' && (
              <div>
                {['constraint','risk'].map(type => (
                  <div key={type} style={{ marginBottom:32 }}>
                    <h3 style={{ color: type==='constraint' ? 'var(--red)' : 'var(--navy)', marginBottom:16 }}>
                      {type === 'constraint' ? '⚠️ Constraints to Avoid' : '🔺 Risks to Avoid'}
                    </h3>
                    {constraints.filter(c => c.type === type).map((c, i) => (
                      <div key={i} style={{ padding:14, background:'var(--light-grey)', borderRadius:8, marginBottom:10 }}>
                        <p style={{ fontSize:14, marginBottom:10 }}>{c.text}</p>
                        <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
                          {GROUP_ORDER.map(gName => {
                            const g = c.groups[gName];
                            if (!g || g.total === 0) return null;
                            const pct = Math.round((g.yes_count / g.total) * 100);
                            return (
                              <div key={gName} style={{ textAlign:'center' }}>
                                <div style={{ fontSize:11, color: GROUP_COLORS[gName], fontWeight:600, marginBottom:2 }}>{gName}</div>
                                <div style={{ fontSize:18, fontWeight:700, color: pct>50?'var(--red)':pct>25?'var(--self)':'var(--green)' }}>
                                  {pct}%
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}

            {/* COMMENTS TAB */}
            {activeTab === 'comments' && (
              <div>
                {['strengths','improvements'].map(type => {
                  const typeComments = data.comments.filter(c => c.comment_type === type);
                  return (
                    <div key={type} style={{ marginBottom:32 }}>
                      <h3 style={{ color:'var(--navy)', marginBottom:16 }}>
                        {type === 'strengths' ? '✅ What is this person doing well?' : '🎯 What should this person do differently?'}
                      </h3>
                      {typeComments.length === 0
                        ? <p style={{ color:'var(--slate)', fontStyle:'italic' }}>No comments submitted yet.</p>
                        : typeComments.map((c, i) => (
                          <div key={i} style={{ padding:14, background:'var(--light-grey)', borderRadius:8, marginBottom:10, borderLeft:'4px solid var(--navy)' }}>
                            <div style={{ fontSize:11, color:'var(--slate)', marginBottom:6 }}>{c.group_name}</div>
                            <p style={{ fontSize:14, lineHeight:1.6 }}>{c.comment_text}</p>
                          </div>
                        ))
                      }
                    </div>
                  );
                })}
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
