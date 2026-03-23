import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api';

const SECTION_ORDER = ['strategy','decision','action','execution','team','influence','integrity','resilience','impact','eq','credibility'];

const SCALE_LABELS = {
  1:'Major Development Gap', 2:'Development Gap', 3:'Potential Development Gap',
  4:'Potential Strength', 5:'Strength', 6:'Outstanding Strength'
};

export default function Survey() {
  const [params] = useSearchParams();
  const code = params.get('code');

  const [state, setState] = useState(null); // { rater_id, group_name, subject_name, questions, constraintItems, ... }
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [step, setStep] = useState(0); // 0..sections.length-1 = ratings, then constraints, then comments, then review
  const [saving, setSaving] = useState(false);

  // Answers state
  const [scores, setScores] = useState({});         // { question_id: { score, cannot_say } }
  const [constraintAnswers, setConstraintAnswers] = useState({}); // { constraint_item_id: true|false }
  const [comments, setComments] = useState({ strengths:'', improvements:'' });

  useEffect(() => {
    if (!code) { setError('No access code.'); setLoading(false); return; }
    api.getSurvey(code)
      .then(data => {
        if (data.submitted) { setSubmitted(true); setState({ subject_name: data.subject_name }); return; }
        // Restore saved answers
        const sc = {};
        data.savedScores?.forEach(s => { sc[s.question_id] = { score: s.score, cannot_say: !!s.cannot_say }; });
        const ca = {};
        data.savedConstraints?.forEach(c => { ca[c.constraint_item_id] = !!c.answer; });
        const cm = { strengths:'', improvements:'' };
        data.savedComments?.forEach(c => { cm[c.comment_type] = c.comment_text; });

        setState(data);
        setScores(sc);
        setConstraintAnswers(ca);
        setComments(cm);
      })
      .catch(() => setError('Invalid or expired access code.'))
      .finally(() => setLoading(false));
  }, [code]);

  // Group questions by section
  const sections = state ? groupSections(state.questions) : [];
  // Group constraint items by section+type
  const constraintSections = state ? groupConstraints(state.constraintItems) : [];

  // Total steps: rating sections + constraint step + comments step + review step
  const totalRatingSteps = sections.length;
  const STEP_CONSTRAINTS = totalRatingSteps;
  const STEP_COMMENTS    = totalRatingSteps + 1;
  const STEP_REVIEW      = totalRatingSteps + 2;
  const TOTAL_STEPS      = totalRatingSteps + 3;

  const progress = Math.round(((step + 1) / TOTAL_STEPS) * 100);

  const saveProgress = useCallback(async () => {
    if (!code || !state) return;
    setSaving(true);
    try {
      await api.saveSurvey({
        code,
        scores: Object.entries(scores).map(([qid, v]) => ({
          question_id: parseInt(qid), score: v.score, cannot_say: v.cannot_say
        })),
        constraintAnswers: Object.entries(constraintAnswers).map(([cid, ans]) => ({
          constraint_item_id: parseInt(cid), answer: ans
        })),
        comments: [
          { type:'strengths', text: comments.strengths },
          { type:'improvements', text: comments.improvements },
        ],
      });
    } catch (e) { console.error('Save failed', e); }
    finally { setSaving(false); }
  }, [code, state, scores, constraintAnswers, comments]);

  const nextStep = async () => {
    await saveProgress();
    setStep(s => s + 1);
    window.scrollTo(0, 0);
  };

  const prevStep = () => { setStep(s => s - 1); window.scrollTo(0, 0); };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await saveProgress();
      await api.submitSurvey(code);
      setSubmitted(true);
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  const setScore = (qid, score) => setScores(s => ({ ...s, [qid]: { score, cannot_say: false } }));
  const setCannotSay = (qid) => setScores(s => ({ ...s, [qid]: { score: null, cannot_say: true } }));
  const setConstraint = (cid, val) => setConstraintAnswers(ca => ({ ...ca, [cid]: val }));

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) return <Loading />;

  if (error) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#f0f2f5' }}>
      <div className="card" style={{ maxWidth:480, textAlign:'center' }}>
        <div style={{ fontSize:48, marginBottom:12 }}>⚠️</div>
        <h2 style={{ color:'var(--navy)' }}>Access Error</h2>
        <p style={{ color:'var(--slate)', marginTop:8 }}>{error}</p>
      </div>
    </div>
  );

  if (submitted) return (
    <div className="survey-page">
      <SurveyHeader subjectName={state?.subject_name} progress={100} />
      <div className="survey-body">
        <div className="card completion-card">
          <div className="icon">🎉</div>
          <h2>Thank you for your feedback!</h2>
          <p>Your responses have been submitted and are completely anonymous.</p>
          <p style={{ marginTop:12, color:'var(--slate)' }}>
            They will be combined with other responses and only group averages will be included in the report for {state?.subject_name}.
          </p>
          <p style={{ marginTop:12 }}>You can now close this window.</p>
        </div>
      </div>
    </div>
  );

  if (!state) return null;

  const sectionCount = Object.values(state.questions.reduce((a,q)=>({...a,[q.section]:1}),{})).length;

  return (
    <div className="survey-page">
      <SurveyHeader subjectName={state.subject_name} progress={progress} step={step} total={TOTAL_STEPS} />

      <div className="survey-body">
        {/* ── Rating sections ── */}
        {step < totalRatingSteps && (() => {
          const sec = sections[step];
          return (
            <>
              <div className="section-card">
                <div className="section-card-header">
                  <h3>{sec.title}</h3>
                  <p style={{ fontSize:12, opacity:0.8, marginTop:4 }}>Rate {state.subject_name} on each statement below</p>
                </div>
                <div className="section-card-body">
                  <div className="scale-legend">
                    {[1,2,3,4,5,6].map(n => (
                      <span key={n} className="item"><strong>{n}</strong> = {SCALE_LABELS[n]}</span>
                    ))}
                  </div>
                  {sec.questions.map(q => {
                    const ans = scores[q.id] || {};
                    return (
                      <div key={q.id} className="rating-row">
                        <div className="rating-q">
                          <div className="q-num">Statement {q.question_number}</div>
                          {q.question_text}
                        </div>
                        <div className="rating-controls">
                          {[1,2,3,4,5,6].map(n => (
                            <button key={n} type="button"
                              className={`rating-btn score-${n} ${ans.score===n && !ans.cannot_say ? 'selected' : ''}`}
                              onClick={() => setScore(q.id, n)}>
                              {n}
                            </button>
                          ))}
                          <button type="button"
                            className={`cannot-say-btn ${ans.cannot_say ? 'selected' : ''}`}
                            onClick={() => setCannotSay(q.id)}>
                            Can't say
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <StepNav step={step} total={TOTAL_STEPS} onBack={step>0?prevStep:null} onNext={nextStep} saving={saving} />
            </>
          );
        })()}

        {/* ── Constraints & Risks ── */}
        {step === STEP_CONSTRAINTS && (
          <>
            <div className="card" style={{ marginBottom:12 }}>
              <h3 style={{ color:'var(--navy)', marginBottom:8 }}>Constraints & Risks</h3>
              <p style={{ color:'var(--slate)', fontSize:14, lineHeight:1.6 }}>
                For each behaviour below, please answer <strong>Yes</strong> if you have observed this, or <strong>No</strong> if you have not.
                This section is about {state.subject_name}.
              </p>
            </div>

            {constraintSections.map(cs => (
              <div key={cs.section + cs.type} className="section-card" style={{ marginBottom:16 }}>
                <div className="section-card-header" style={{ background: cs.type==='constraint' ? 'var(--red)' : 'var(--navy)' }}>
                  <h3>{cs.sectionTitle} — {cs.type === 'constraint' ? 'Constraints to Avoid' : 'Risks to Avoid'}</h3>
                </div>
                <div className="section-card-body">
                  {cs.items.map(item => {
                    const ans = constraintAnswers[item.id];
                    return (
                      <div key={item.id} className="yn-row">
                        <div className="yn-text">{item.item_text}</div>
                        <div className="yn-btns">
                          <button type="button" className={`yn-btn yes ${ans===true?'selected':''}`}
                            onClick={() => setConstraint(item.id, true)}>Yes</button>
                          <button type="button" className={`yn-btn no ${ans===false?'selected':''}`}
                            onClick={() => setConstraint(item.id, false)}>No</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            <StepNav step={step} total={TOTAL_STEPS} onBack={prevStep} onNext={nextStep} saving={saving} />
          </>
        )}

        {/* ── Open-ended comments ── */}
        {step === STEP_COMMENTS && (
          <>
            <div className="card">
              <h3 style={{ color:'var(--navy)', marginBottom:16 }}>Open-Ended Feedback</h3>
              <p style={{ color:'var(--slate)', fontSize:14, marginBottom:20 }}>
                Please share your honest thoughts. Your comments are completely anonymous and will only be shared as written — no identifying information is included.
              </p>

              <div className="form-group">
                <label>What is {state.subject_name} doing well — strengths that should be maintained?</label>
                <textarea rows={5} value={comments.strengths}
                  onChange={e => setComments(c => ({ ...c, strengths: e.target.value }))}
                  placeholder="Share specific examples where possible…" />
              </div>

              <div className="form-group">
                <label>What should {state.subject_name} stop doing or do differently to be more effective?</label>
                <textarea rows={5} value={comments.improvements}
                  onChange={e => setComments(c => ({ ...c, improvements: e.target.value }))}
                  placeholder="Be constructive — focus on behaviours and impact…" />
              </div>
            </div>
            <StepNav step={step} total={TOTAL_STEPS} onBack={prevStep} onNext={nextStep} saving={saving} />
          </>
        )}

        {/* ── Review & Submit ── */}
        {step === STEP_REVIEW && (
          <>
            <div className="card">
              <h3 style={{ color:'var(--navy)', marginBottom:12 }}>Review & Submit</h3>
              <p style={{ color:'var(--slate)', fontSize:14, marginBottom:20 }}>
                Please review your completion below, then submit. Once submitted, your responses cannot be changed.
              </p>

              {/* Completion summary */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:12, marginBottom:20 }}>
                {sections.map(sec => {
                  const answered = sec.questions.filter(q => scores[q.id]?.score || scores[q.id]?.cannot_say).length;
                  const complete = answered === sec.questions.length;
                  return (
                    <div key={sec.section} style={{ padding:12, borderRadius:8, border:'1px solid #ddd',
                      background: complete ? '#f0fff0' : '#fff8f0' }}>
                      <div style={{ fontSize:12, color:'var(--slate)', marginBottom:4 }}>{sec.title}</div>
                      <div style={{ fontSize:13, fontWeight:600, color: complete ? 'var(--green)' : 'var(--self)' }}>
                        {complete ? '✓ Complete' : `${answered}/${sec.questions.length} rated`}
                      </div>
                    </div>
                  );
                })}
                <div style={{ padding:12, borderRadius:8, border:'1px solid #ddd', background:'#f0f4ff' }}>
                  <div style={{ fontSize:12, color:'var(--slate)', marginBottom:4 }}>Constraints & Risks</div>
                  <div style={{ fontSize:13, fontWeight:600, color:'var(--navy)' }}>
                    {Object.keys(constraintAnswers).length} answered
                  </div>
                </div>
                <div style={{ padding:12, borderRadius:8, border:'1px solid #ddd', background:'#f0f4ff' }}>
                  <div style={{ fontSize:12, color:'var(--slate)', marginBottom:4 }}>Comments</div>
                  <div style={{ fontSize:13, fontWeight:600, color:'var(--navy)' }}>
                    {(comments.strengths || comments.improvements) ? '✓ Added' : 'Optional'}
                  </div>
                </div>
              </div>

              <div className="alert alert-info">
                <strong>Your anonymity is protected.</strong> Your responses are combined with other raters in your group. Only group averages and percentages are shown in the report — never individual responses.
              </div>

              {error && <div className="alert alert-error">{error}</div>}
            </div>

            <div className="step-nav" style={{ justifyContent:'center', gap:16 }}>
              <button className="btn btn-secondary" onClick={prevStep}>← Back</button>
              <button className="btn btn-success" onClick={handleSubmit} disabled={saving}
                style={{ minWidth:180, fontSize:16 }}>
                {saving ? 'Submitting…' : '✓ Submit Feedback'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Helper components ──────────────────────────────────────────────────────
function SurveyHeader({ subjectName, progress, step, total }) {
  return (
    <div className="survey-header">
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div className="logo">motivus <span>CONSULTING</span></div>
        {subjectName && <div style={{ fontSize:13, opacity:0.8 }}>Feedback for {subjectName}</div>}
      </div>
      <div className="survey-progress">
        <div className="survey-progress-bar" style={{ width:`${progress}%` }} />
      </div>
    </div>
  );
}

function StepNav({ step, total, onBack, onNext, saving }) {
  return (
    <div className="step-nav">
      <button className="btn btn-secondary" onClick={onBack} disabled={!onBack}>← Back</button>
      <div className="step-info">Step {step + 1} of {total}</div>
      <button className="btn btn-primary" onClick={onNext} disabled={saving}>
        {saving ? 'Saving…' : step === total - 2 ? 'Review →' : 'Next →'}
      </button>
    </div>
  );
}

function Loading() {
  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:12 }}>
      <div style={{ fontSize:48 }}>⏳</div>
      <p style={{ color:'var(--slate)' }}>Loading your survey…</p>
    </div>
  );
}

// ── Data helpers ───────────────────────────────────────────────────────────
function groupSections(questions) {
  const map = {};
  questions.forEach(q => {
    if (!map[q.section]) map[q.section] = { section: q.section, title: q.section_title, questions: [] };
    map[q.section].questions.push(q);
  });
  return SECTION_ORDER.filter(s => map[s]).map(s => map[s]);
}

function groupConstraints(items) {
  const map = {};
  items.forEach(item => {
    const key = `${item.section}_${item.item_type}`;
    if (!map[key]) map[key] = { section: item.section, sectionTitle: getSectionTitle(item.section), type: item.item_type, items: [] };
    map[key].items.push(item);
  });
  // Order by section then type (constraint before risk)
  return SECTION_ORDER.flatMap(s =>
    ['constraint','risk'].map(t => map[`${s}_${t}`]).filter(Boolean)
  );
}

function getSectionTitle(section) {
  const map = {
    strategy:'Skill: Strategy and Long Term', decision:'Skill: Decision Making',
    action:'Skill: Action Plans', execution:'Skill: Making Things Happen',
    team:'Skill: Creating a Winning Team', influence:'Skill: Communicating with Impact',
    integrity:'Behaviour: Integrity and Respect', resilience:'Behaviour: Resilience',
    impact:'Behaviour: Impact', eq:'Behaviour: Emotional Intellect', credibility:'Behaviour: Credibility',
  };
  return map[section] || section;
}
