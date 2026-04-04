import React, { createContext, useContext, useState, ReactNode } from 'react';

type ModeType = 'diagnostic' | 'practice';
type QuestionType = 'conversation' | 'true-false' | 'multiple-choice' | 'identification' | 'solution';
type CourseType = 'calculus1' | 'calculus2' | 'calculus3' | 'linearalgebra' | 'differentialequations' | 'engineeringmath' | 'discretemath' | 'statistics';

interface FilterContextType {
  selectedMode: ModeType;
  setSelectedMode: (mode: ModeType) => void;
  selectedCourse: CourseType;
  setSelectedCourse: (course: CourseType) => void;
  selectedQuestionType: QuestionType;
  setSelectedQuestionType: (type: QuestionType) => void;
}

const FilterContext = createContext<FilterContextType | undefined>(undefined);

export function FilterProvider({ children }: { children: ReactNode }) {
  const [selectedMode, setSelectedMode] = useState<ModeType>('practice');
  const [selectedCourse, setSelectedCourse] = useState<CourseType>('calculus1');
  const [selectedQuestionType, setSelectedQuestionType] = useState<QuestionType>('multiple-choice');

  return (
    <FilterContext.Provider
      value={{
        selectedMode,
        setSelectedMode,
        selectedCourse,
        setSelectedCourse,
        selectedQuestionType,
        setSelectedQuestionType,
      }}
    >
      {children}
    </FilterContext.Provider>
  );
}

export function useFilters() {
  const context = useContext(FilterContext);
  if (context === undefined) {
    throw new Error('useFilters must be used within a FilterProvider');
  }
  return context;
}
