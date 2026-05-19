import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { NavLink } from 'react-router-dom';
import { Clock, CheckCircle2, ArrowRight, Trophy } from 'lucide-react';

import { toast } from 'sonner';

export default function OnlineExams() {
  const [exams, setExams] = React.useState([]);
  const [active, setActive] = useState(null);

  return (
    <div className="space-y-5" data-testid="online-exams">
      <NavLink to=".." className="label-eyebrow text-primary">← Back</NavLink>
      <h1 className="font-display font-black text-3xl tracking-tighter uppercase">Online Exams</h1>

      {!active && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {exams.map((e) => (
            <motion.div key={e.id} whileHover={{ y: -5, scale: 1.02 }} className="glass-morphism rounded-[2rem] p-5">
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-1 rounded-full bg-orange-500/10 text-orange-500 label-eyebrow">{e.status}</span>
                <div className="flex items-center gap-1.5 label-eyebrow text-muted-foreground"><Clock className="h-3 w-3" />{e.duration}m</div>
              </div>
              <div className="font-display font-black text-2xl tracking-tighter mt-3">{e.title}</div>
              <div className="label-eyebrow text-muted-foreground mt-1">{e.subjectName} · Class {e.className}</div>
              <div className="mt-4 flex items-center justify-between">
                <div className="text-xs text-muted-foreground">{e.questions.length} questions · {e.totalMarks} marks</div>
                <button onClick={() => setActive(e)} className="h-10 px-4 rounded-2xl bg-primary text-primary-foreground label-eyebrow flex items-center gap-2" data-testid={`start-exam-${e.id}`}>
                  Start <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {active && <ExamRunner exam={active} onClose={() => setActive(null)} />}
    </div>
  );
}

function ExamRunner({ exam, onClose }) {
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState({});
  const [remaining, setRemaining] = useState(exam.duration * 60);
  const [done, setDone] = useState(false);
  const [score, setScore] = useState(0);

  useEffect(() => {
    if (done) return;
    const t = setInterval(() => setRemaining((r) => Math.max(0, r - 1)), 1000);
    return () => clearInterval(t);
  }, [done]);

  useEffect(() => { if (remaining === 0 && !done) submit(); }, [remaining]); // eslint-disable-line

  const q = exam.questions[idx];

  const submit = () => {
    let s = 0;
    exam.questions.forEach((qq) => {
      if (answers[qq.id] === qq.correctAnswer) s += qq.marks;
    });
    setScore(s);
    setDone(true);
    // examResponse: { examId: exam.id, studentId: 'demo-stu-1', answers, score, submittedAt: new Date().toISOString() });
    toast.success(`Submitted · ${s}/${exam.totalMarks}`);
  };

  const mins = String(Math.floor(remaining / 60)).padStart(2, '0');
  const secs = String(remaining % 60).padStart(2, '0');

  if (done) {
    const pct = Math.round((score / exam.totalMarks) * 100);
    return (
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass-morphism rounded-[2rem] p-8 text-center max-w-lg mx-auto" data-testid="exam-result">
        <div className="h-16 w-16 mx-auto rounded-3xl bg-emerald-500/10 grid place-items-center"><Trophy className="h-8 w-8 text-emerald-500" /></div>
        <div className="font-display font-black text-3xl tracking-tighter mt-4">Exam Submitted</div>
        <div className="mt-4 font-display font-black text-6xl tracking-tighter text-emerald-500">
          {score}<span className="text-3xl text-muted-foreground">/{exam.totalMarks}</span>
        </div>
        <div className="label-eyebrow text-muted-foreground mt-2">{pct}% · {Object.keys(answers).length} answered</div>
        <button onClick={onClose} className="mt-6 h-11 px-5 rounded-2xl bg-primary text-primary-foreground label-eyebrow">Back to Exams</button>
      </motion.div>
    );
  }

  return (
    <div className="glass-morphism rounded-[2rem] p-6" data-testid="exam-runner">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="font-display font-black text-2xl tracking-tighter">{exam.title}</div>
          <div className="label-eyebrow text-muted-foreground">Question {idx + 1} of {exam.questions.length}</div>
        </div>
        <div className={`px-3 py-2 rounded-2xl ${remaining < 60 ? 'bg-rose-500/10 text-rose-500' : 'bg-primary/10 text-primary'} font-mono font-black flex items-center gap-2`}>
          <Clock className="h-4 w-4" />{mins}:{secs}
        </div>
      </div>

      <div className="h-1.5 rounded-full bg-muted overflow-hidden mb-5">
        <motion.div animate={{ width: `${((idx + 1) / exam.questions.length) * 100}%` }} className="h-full bg-gradient-to-r from-indigo-500 to-fuchsia-500" />
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={q.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
          <div className="font-display font-black text-xl tracking-tight">{q.question}</div>
          <div className="mt-4 space-y-2">
            {q.options.map((opt, i) => {
              const picked = answers[q.id] === i;
              return (
                <button key={i} onClick={() => setAnswers((a) => ({ ...a, [q.id]: i }))} data-testid={`exam-opt-${q.id}-${i}`} className={`w-full text-left p-4 rounded-2xl border-2 transition-all ${picked ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/30'}`}>
                  <div className="flex items-center gap-3">
                    <div className={`h-7 w-7 rounded-full grid place-items-center text-xs font-black ${picked ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>{String.fromCharCode(65 + i)}</div>
                    <div className="text-sm font-medium">{opt}</div>
                    {picked && <CheckCircle2 className="h-4 w-4 text-primary ml-auto" />}
                  </div>
                </button>
              );
            })}
          </div>
        </motion.div>
      </AnimatePresence>

      <div className="flex items-center justify-between mt-6">
        <button onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx === 0} className="h-11 px-5 rounded-2xl bg-muted label-eyebrow disabled:opacity-40" data-testid="exam-prev">Previous</button>
        {idx < exam.questions.length - 1 ? (
          <button onClick={() => setIdx((i) => i + 1)} className="h-11 px-5 rounded-2xl bg-primary text-primary-foreground label-eyebrow" data-testid="exam-next">Next →</button>
        ) : (
          <button onClick={submit} className="h-11 px-5 rounded-2xl bg-emerald-500 text-white label-eyebrow" data-testid="exam-submit">Submit Exam</button>
        )}
      </div>
    </div>
  );
}
