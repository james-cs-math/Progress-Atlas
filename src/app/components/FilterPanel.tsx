import React, { useState, useMemo, useEffect } from 'react';
import { useFilters } from '../lib/FilterContext';
import { useTier } from '../lib/TierContext';
import { 
  Target, 
  Dumbbell, 
  BookOpen,
  CheckCircle,
  ListChecks,
  HelpCircle,
  XCircle,
  ChevronDown,
  ChevronRight,
  Check,
  Zap 
} from 'lucide-react';

const TIER_LIMITS = {
  euclid: { diagnostics: 2, practice: 25 },
  aristotle: { diagnostics: 15, practice: Infinity },
  plato: { diagnostics: Infinity, practice: Infinity },
  socrates: { diagnostics: Infinity, practice: Infinity }
};

const MODES = [
  { id: 'diagnostic' as const, label: 'Diagnostic Test', icon: Target },
  { id: 'practice' as const, label: 'Practice Questions', icon: Dumbbell },
];

const COURSES = [
  { id: 'calculus1' as const, label: 'Differential Calculus' },
  { id: 'calculus2' as const, label: 'Integral Calculus' },
  { id: 'calculus3' as const, label: 'Multivariate Calculus' },
  { id: 'linearalgebra' as const, label: 'Linear Algebra' },
  { id: 'differentialequations' as const, label: 'Differential Equations' },
  { id: 'engineeringmath' as const, label: 'Engineering Mathematics' },
  { id: 'discretemath' as const, label: 'Discrete Mathematics' },
  { id: 'statistics' as const, label: 'Statistics & Probability' },
];

const QUESTION_TYPES = [
  { id: 'true-false' as const, label: 'True or False', icon: CheckCircle },
  { id: 'multiple-choice' as const, label: 'Multiple Choice', icon: ListChecks },
  { id: 'identification' as const, label: 'Identification', icon: HelpCircle },
  { id: 'solution' as const, label: 'Solution-Based', icon: XCircle },
];

function readUsageFromStorage(tier: string) {
  try {
    const history = JSON.parse(localStorage.getItem('atlas_test_history') || '[]');
    const now = new Date();
    const thisMonth = history.filter((s: any) => {
      const d = new Date(s.timestamp);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const usedDiags = thisMonth.filter((s: any) => s.setType === 'diagnostic').length;
    const usedPractice = thisMonth.filter((s: any) => s.setType === 'practice').length;
    const limits = TIER_LIMITS[tier as keyof typeof TIER_LIMITS] || TIER_LIMITS.euclid;
    return {
      remDiags: limits.diagnostics === Infinity ? '∞' : Math.max(0, limits.diagnostics - usedDiags),
      remPractice: limits.practice === Infinity ? '∞' : Math.max(0, limits.practice - usedPractice),
    };
  } catch {
    return { remDiags: 0, remPractice: 0 };
  }
}

export function FilterPanel() {
  const {
    selectedMode,
    setSelectedMode,
    selectedCourse,
    setSelectedCourse,
    selectedQuestionType,
    setSelectedQuestionType,
  } = useFilters();

  const { currentTier = 'euclid' } = useTier() || {};
  const [modeOpen, setModeOpen] = useState(true);
  const [courseOpen, setCourseOpen] = useState(true);
  const [questionTypeOpen, setQuestionTypeOpen] = useState(true);
  const [usage, setUsage] = useState(() => readUsageFromStorage(currentTier));

  // Re-read whenever tier changes or storage is updated
  useEffect(() => {
    setUsage(readUsageFromStorage(currentTier));
  }, [currentTier]);

  useEffect(() => {
    const onStorage = () => setUsage(readUsageFromStorage(currentTier));
    window.addEventListener('atlas_usage_updated', onStorage);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('atlas_usage_updated', onStorage);
      window.removeEventListener('storage', onStorage);
    };
  }, [currentTier]);

  const toggleCourse = (courseId: any) => {
    const currentSelection = Array.isArray(selectedCourse) ? selectedCourse : [selectedCourse];
    if ((currentSelection as any[]).includes(courseId)) {
      setSelectedCourse(currentSelection.filter(id => id !== courseId) as any);
    } else {
      setSelectedCourse([...currentSelection, courseId] as any);
    }
  };

  return (
    <div className="space-y-4 select-none">
      
      {/* Usage Monitor */}
      <div className="grid grid-cols-2 gap-2 mb-6">
        <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 shadow-xl flex flex-col items-center justify-center text-center">
           <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1 leading-none">Diagnostic</p>
           <p className="text-4xl font-black text-white italic tracking-tighter leading-none py-1">
             {usage.remDiags}
           </p>
           <p className="text-[8px] font-bold text-indigo-400 uppercase opacity-70">Remaining</p>
        </div>

        <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 shadow-xl flex flex-col items-center justify-center text-center">
           <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1 leading-none">Questions</p>
           <p className="text-4xl font-black text-white italic tracking-tighter leading-none py-1">
             {usage.remPractice}
           </p>
           <p className="text-[8px] font-bold text-blue-400 opacity-70 uppercase">Remaining</p>
        </div>
      </div>

      <div className="px-1 mb-2">
        <div className="flex items-center gap-2 text-[10px] font-black text-slate-300 uppercase tracking-widest opacity-60">
          <Zap size={10} /> Active Filters
        </div>
      </div>

      {/* Mode Selection */}
      <div>
        <button
          onClick={() => setModeOpen(!modeOpen)}
          className="w-full flex items-center justify-between text-sm font-bold text-slate-700 mb-2 hover:text-indigo-600 transition-colors px-1"
        >
          <div className="flex items-center gap-2">
            <Target size={16} className="text-slate-400" />
            Mode
          </div>
          {modeOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        {modeOpen && (
          <div className="space-y-1">
            {MODES.map((mode) => {
              const isSelected = selectedMode === mode.id;
              return (
                <button
                  key={mode.id}
                  onClick={() => setSelectedMode(mode.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-all border group ${
                    isSelected
                      ? 'bg-slate-900 border-slate-900 text-white font-black shadow-lg shadow-slate-200'
                      : 'border-transparent text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <mode.icon size={14} className={isSelected ? 'text-white' : 'text-slate-400'} />
                    <span>{mode.label}</span>
                  </div>
                  {isSelected && <Check size={14} strokeWidth={4} className="text-white" />}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Course Selection */}
      <div>
        <button
          onClick={() => setCourseOpen(!courseOpen)}
          className="w-full flex items-center justify-between text-sm font-bold text-slate-700 mb-2 hover:text-indigo-600 transition-colors px-1"
        >
          <div className="flex items-center gap-2">
            <BookOpen size={16} className="text-slate-400" />
            Courses
            {Array.isArray(selectedCourse) && selectedCourse.length > 0 && (
              <span className="ml-1 bg-indigo-600 text-white px-2 py-0.5 rounded-full text-[9px] font-black">
                {selectedCourse.length}
              </span>
            )}
          </div>
          {courseOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        
        {courseOpen && (
          <div className="space-y-1 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
            {COURSES.map((course) => {
              const isSelected = Array.isArray(selectedCourse) 
                ? (selectedCourse as any[]).includes(course.id)
                : selectedCourse === course.id;

              return (
                <button
                  key={course.id}
                  onClick={() => toggleCourse(course.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-all border group ${
                    isSelected
                      ? 'bg-slate-900 border-slate-900 text-white font-bold shadow-lg shadow-slate-200'
                      : 'border-transparent text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <span className="truncate">{course.label}</span>
                  {isSelected && <Check size={14} strokeWidth={4} className="text-white shrink-0 ml-2" />}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Question Type Selection */}
      <div>
        <button
          onClick={() => setQuestionTypeOpen(!questionTypeOpen)}
          className="w-full flex items-center justify-between text-sm font-bold text-slate-700 mb-2 hover:text-indigo-600 transition-colors px-1"
        >
          <div className="flex items-center gap-2">
            <ListChecks size={16} className="text-slate-400" />
            Question Type
          </div>
          {questionTypeOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        {questionTypeOpen && (
          <div className="space-y-1 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
            {QUESTION_TYPES.map((type) => {
              const isSelected = selectedQuestionType === type.id;
              return (
                <button
                  key={type.id}
                  onClick={() => setSelectedQuestionType(type.id as any)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-all border group ${
                    isSelected
                      ? 'bg-slate-900 border-slate-900 text-white font-black shadow-lg shadow-slate-200'
                      : 'border-transparent text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate text-left">
                    <type.icon size={14} className={isSelected ? 'text-white' : 'text-slate-400'} />
                    <span className="truncate">{type.label}</span>
                  </div>
                  {isSelected && <Check size={14} strokeWidth={4} className="text-white shrink-0 ml-2" />}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <style>{`
        .custom-scrollbar { scrollbar-width: thin; scrollbar-color: #cbd5e1 transparent; }
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 20px; border: 1px solid transparent; background-clip: content-box; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background-color: #94a3b8; }
      `}</style>
    </div>
  );
}