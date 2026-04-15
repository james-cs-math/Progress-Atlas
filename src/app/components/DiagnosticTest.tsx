import React, { useState, useEffect } from 'react';
import { useFilters } from '../lib/FilterContext';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Loader2, Eye, AlertCircle, Sparkles, ArrowRight } from 'lucide-react';
import { InlineMath, BlockMath } from 'react-katex';
import { aiService } from '../../aiService';
import { motion, AnimatePresence } from 'framer-motion';

// ─── AI Grader (Groq) ─────────────────────────────────────────────────────────
const GROQ_API_KEY = "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";
const GROQ_URL = "https://api.groq.com/openai/v1";

async function gradeWithAI(
  questionText: string,
  correctAnswer: string,
  studentAnswer: string,
  answerFormat: 'identification' | 'solution'
): Promise<{ isCorrect: boolean; feedback: string }> {
  const systemPrompt = `You are a strict but fair mathematics and science grader.
Your job is to determine if a student's answer is mathematically / conceptually equivalent to the correct answer.

Rules:
- Treat different but equivalent forms as CORRECT (e.g. "x^2/2 + C" == "\\frac{x^2}{2} + C", "0.5" == "1/2").
- Ignore superficial differences: extra spaces, different variable casing, extra constant of integration when expected.
- For solution-based answers: check that the KEY reasoning steps and final answer are logically sound and reach the correct conclusion. Minor computational errors can be flagged but do not make the whole answer wrong if the method is right.
- Respond ONLY with a valid JSON object — no markdown, no preamble.
- Format: {"isCorrect": true|false, "feedback": "One concise sentence explaining why."}`;

  const userPrompt = answerFormat === 'identification'
    ? `Question: ${questionText}\nCorrect Answer: ${correctAnswer}\nStudent Answer: ${studentAnswer}\n\nIs the student's answer mathematically/conceptually equivalent to the correct answer?`
    : `Question: ${questionText}\nCorrect Final Answer: ${correctAnswer}\nStudent's Full Solution:\n${studentAnswer}\n\nDoes the student's solution correctly arrive at the right answer with valid reasoning?`;

  try {
    const response = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' },
      }),
    });
    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content ?? '';
    const clean = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    return { isCorrect: Boolean(parsed.isCorrect), feedback: parsed.feedback ?? '' };
  } catch {
    return {
      isCorrect: studentAnswer.toLowerCase().trim() === correctAnswer.toLowerCase().trim(),
      feedback: 'Could not reach AI grader — fell back to exact match.',
    };
  }
}

// ─── Save completed diagnostic session ───────────────────────────────────────
function saveDiagnosticSession(
  topic: string,
  course: string,
  responses: any[],
  totalQuestions: number
) {
  try {
    const history: any[] = JSON.parse(localStorage.getItem('atlas_test_history') || '[]');
    const correctCount = responses.filter(r => r.isCorrect).length;
    const accuracy = Math.round((correctCount / totalQuestions) * 100);

    // Replace any open (incomplete) session for this topic, otherwise push new
    const openIdx = history.findLastIndex(
      (s: any) => s.setType === 'diagnostic' && s.topic === topic && !s.results?.completed
    );

    const sessionEntry = {
      id: `diag_${Date.now()}`,
      timestamp: openIdx >= 0 ? history[openIdx].timestamp : new Date().toISOString(),
      setType: 'diagnostic',
      topic,
      course,
      results: {
        completed: true,
        totalQuestions,
        correctCount,
        accuracy,
        responses,
      },
    };

    if (openIdx >= 0) {
      history[openIdx] = sessionEntry;
    } else {
      history.push(sessionEntry);
    }

    localStorage.setItem('atlas_test_history', JSON.stringify(history));

    // Dispatch AFTER writing so any listener re-reads the updated data
    window.dispatchEvent(new Event('atlas_usage_updated'));
  } catch (e) {
    console.error('Failed to save diagnostic session:', e);
  }
}

// ─── Text Renderer ────────────────────────────────────────────────────────────
const sanitizeOption = (text: string): string => {
  const trimmed = text.trim();
  if (trimmed.includes('\n') && !trimmed.startsWith('$')) {
    const joined = trimmed.split('\n').map(l => l.trim()).filter(Boolean).join(' ');
    return `$${joined}$`;
  }
  return trimmed;
};

const renderText = (text?: string): React.ReactNode => {
  if (!text) return null;
  const parts = text.split(/(\$\$[\s\S]+?\$\$|\$[^$]+?\$)/g);
  return (
    <span>
      {parts.map((part, i) => {
        if (part.startsWith('$$') && part.endsWith('$$'))
          return <BlockMath key={i} math={part.slice(2, -2)} />;
        if (part.startsWith('$') && part.endsWith('$'))
          return <InlineMath key={i} math={part.slice(1, -1)} />;
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
};

// ─── Component ────────────────────────────────────────────────────────────────
export function DiagnosticTest({ onComplete, topic }: { onComplete: () => void; topic: string }) {
  const { selectedCourse, selectedQuestionType } = useFilters();
  const [questions, setQuestions] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [grading, setGrading] = useState(false);
  const [responses, setResponses] = useState<any[]>([]);

  useEffect(() => {
    async function getQuestions() {
      setLoading(true);
      try {
        const data = await aiService.ask(selectedCourse as string, topic, selectedQuestionType, 10);
        if (data) setQuestions(data);
      } catch (e) {
        console.error('Diagnostic Fetch Error:', e);
      } finally {
        setLoading(false);
      }
    }
    getQuestions();
  }, [topic, selectedCourse, selectedQuestionType]);

  const handleSubmit = async () => {
    const q = questions[currentIndex];
    if (!selectedAnswer || !q || grading) return;

    const fmt = q.answerFormat;
    const isLast = currentIndex === questions.length - 1;

    let isCorrect = false;
    let feedback = '';

    if (fmt === 'multiple-choice' || fmt === 'true-false') {
      isCorrect = selectedAnswer.toUpperCase() === q.correctAnswer.toUpperCase();
    } else {
      setGrading(true);
      try {
        const result = await gradeWithAI(
          q.questionText,
          q.correctAnswer,
          selectedAnswer,
          fmt === 'solution' || fmt === 'solution-based' ? 'solution' : 'identification'
        );
        isCorrect = result.isCorrect;
        feedback = result.feedback;
      } catch {
        isCorrect = false;
        feedback = 'Grading unavailable.';
      } finally {
        setGrading(false);
      }
    }

    const newResponse = {
      questionText: q.questionText,
      answerFormat: fmt,
      options: q.options,
      userAnswer: selectedAnswer,
      correctAnswer: q.correctAnswer,
      explanation: q.explanation,
      rule: q.rule ?? q.topic ?? topic,
      isCorrect,
      aiFeedback: feedback,
    };

    const updatedResponses = [...responses, newResponse];
    setResponses(updatedResponses);

    if (!isLast) {
      setCurrentIndex(prev => prev + 1);
      setSelectedAnswer('');
    } else {
      // ── Save first, THEN call onComplete so the dashboard is still mounted
      //    when the atlas_usage_updated event fires ──
      const course = Array.isArray(selectedCourse) ? selectedCourse[0] : (selectedCourse ?? '');
      saveDiagnosticSession(topic, course, updatedResponses, questions.length);

      // Small delay so the event listener has time to fire before unmount
      setTimeout(() => onComplete(), 50);
    }
  };

  if (loading) return (
    <div className="p-20 text-center flex flex-col items-center justify-center space-y-4">
      <Loader2 className="animate-spin text-indigo-600" size={48} />
      <p className="text-slate-400 font-black text-xs uppercase tracking-[0.3em] animate-pulse">
        Generating 10-Question Diagnostic...
      </p>
    </div>
  );

  if (questions.length === 0) return (
    <div className="p-20 text-center">
      <AlertCircle className="mx-auto text-red-400 mb-4" size={48} />
      <Button onClick={() => window.location.reload()}>Retry Connection</Button>
    </div>
  );

  const q = questions[currentIndex];

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">

      {/* Header & Progress */}
      <div className="flex justify-between items-end px-4">
        <div className="space-y-1">
          <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Diagnostic Examination</p>
          <h2 className="text-2xl font-black text-slate-800 uppercase italic tracking-tighter">{topic}</h2>
        </div>
        <div className="text-right">
          <span className="text-3xl font-black text-slate-900">{currentIndex + 1}</span>
          <span className="text-slate-300 font-bold">/{questions.length}</span>
        </div>
      </div>
      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
          className="h-full bg-indigo-600"
          transition={{ duration: 0.4 }}
        />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.25 }}
        >
          <Card className="overflow-hidden border-none shadow-2xl rounded-[2.5rem] bg-white">
            <div className="bg-slate-900 p-12 text-center text-white text-2xl italic leading-relaxed">
              {renderText(q.questionText)}
            </div>

            <CardContent className="p-10 space-y-6">

              {/* MULTIPLE CHOICE */}
              {q.answerFormat === 'multiple-choice' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {Object.entries(q.options || {}).slice(0, 4).map(([key, value]) => (
                    <button
                      key={key}
                      onClick={() => setSelectedAnswer(key)}
                      className={`p-6 rounded-2xl border-2 flex items-center gap-4 text-left transition-all ${
                        selectedAnswer === key
                          ? 'border-indigo-600 bg-indigo-50 shadow-inner'
                          : 'border-slate-100 hover:border-indigo-200'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black shrink-0 ${
                        selectedAnswer === key ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'
                      }`}>{key}</div>
                      <div className="font-bold text-slate-700">{renderText(sanitizeOption(value as string))}</div>
                    </button>
                  ))}
                </div>
              )}

              {/* TRUE / FALSE */}
              {q.answerFormat === 'true-false' && (
                <div className="grid grid-cols-2 gap-4">
                  {['A', 'B'].map((key) => (
                    <button
                      key={key}
                      onClick={() => setSelectedAnswer(key)}
                      className={`p-10 rounded-3xl border-2 text-center transition-all ${
                        selectedAnswer === key ? 'border-indigo-600 bg-indigo-50' : 'border-slate-100'
                      }`}
                    >
                      <p className="text-sm font-black text-slate-400 mb-1">{key}</p>
                      <p className="text-2xl font-black text-slate-800">{key === 'A' ? 'TRUE' : 'FALSE'}</p>
                    </button>
                  ))}
                </div>
              )}

              {/* IDENTIFICATION */}
              {q.answerFormat === 'identification' && (
                <div className="space-y-4">
                  <input
                    type="text"
                    value={selectedAnswer}
                    onChange={(e) => setSelectedAnswer(e.target.value)}
                    placeholder="Enter final value (e.g. \frac{1}{2}x^2 + C)"
                    className="w-full p-6 rounded-2xl border-2 border-slate-100 focus:border-indigo-600 outline-none text-xl font-bold"
                  />
                  {selectedAnswer && (
                    <div className="p-6 bg-indigo-50 rounded-2xl border border-indigo-100">
                      <p className="text-[10px] font-bold text-indigo-400 uppercase mb-2 flex items-center gap-1">
                        <Eye size={12} /> Math Preview
                      </p>
                      <div className="text-2xl text-indigo-900">
                        <BlockMath math={selectedAnswer.replace(/\$/g, '')} />
                      </div>
                    </div>
                  )}
                  <p className="text-[10px] text-slate-400 flex items-center gap-1">
                    <Sparkles size={10} /> AI-powered grading — equivalent forms are accepted
                  </p>
                </div>
              )}

              {/* SOLUTION-BASED */}
              {(q.answerFormat === 'solution' || q.answerFormat === 'solution-based') && (
                <div className="space-y-4">
                  <textarea
                    rows={6}
                    value={selectedAnswer}
                    onChange={(e) => setSelectedAnswer(e.target.value)}
                    placeholder="Type your step-by-step solution. Use $...$ for math."
                    className="w-full p-6 rounded-2xl border-2 border-slate-100 focus:border-indigo-600 outline-none text-lg"
                  />
                  {selectedAnswer && (
                    <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200">
                      <p className="text-[10px] font-black text-slate-400 uppercase mb-3 flex items-center gap-1">
                        <Eye size={12} /> Live Rendering
                      </p>
                      <div className="prose max-w-none text-slate-700">{renderText(selectedAnswer)}</div>
                    </div>
                  )}
                  <p className="text-[10px] text-slate-400 flex items-center gap-1">
                    <Sparkles size={10} /> AI-powered grading — your reasoning and final answer are evaluated
                  </p>
                </div>
              )}

              <Button
                onClick={handleSubmit}
                disabled={!selectedAnswer || grading}
                className={`w-full h-20 text-xl font-black rounded-3xl mt-4 transition-all ${
                  selectedAnswer && !grading
                    ? 'bg-indigo-600 text-white shadow-xl hover:scale-[1.01]'
                    : 'bg-slate-200 text-slate-400'
                }`}
              >
                {grading ? (
                  <span className="flex items-center justify-center gap-3">
                    <Loader2 className="animate-spin" size={22} />
                    AI IS GRADING YOUR ANSWER...
                  </span>
                ) : currentIndex < questions.length - 1 ? (
                  <span className="flex items-center justify-center gap-3">
                    SUBMIT & CONTINUE <ArrowRight size={22} />
                  </span>
                ) : (
                  'SUBMIT & VIEW RESULTS'
                )}
              </Button>

            </CardContent>
          </Card>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
