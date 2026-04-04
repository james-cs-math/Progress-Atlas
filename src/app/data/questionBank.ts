// src/app/data/questionBank.ts

export type QuestionType = 'multiple-choice' | 'true-false' | 'identification' | 'solution';

export interface Question {
  id: string;
  type: QuestionType;
  questionText: string;
  options?: { A: string; B: string; C?: string; D?: string; };
  correctAnswer: string; 
  set: 'initial' | 'reinforcement' | 'deep-probe';
  rule: string[];
  recommendation: string;
  prerequisite: string;
  calculationSlip: string;
  conceptualGap: string;
}

const multipleChoiceQuestions: Question[] = [
  {
    id: 'calc1-q1',
    type: 'multiple-choice',
    questionText: '\\text{Determine the first derivative of } f(x) = x^7',
    options: { A: '7x^6', B: '6x^7', C: '7x^7', D: 'x^6' },
    correctAnswer: 'A',
    set: 'initial',
    rule: ['Power Rule'],
    recommendation: "Review the $x^n$ rule where $f'(x) = nx^{n-1}$.",
    prerequisite: "Basic Polynomial notation.",
    calculationSlip: "Subtracting 1 from the exponent incorrectly.",
    conceptualGap: "Confusing differentiation with integration (increasing the power)."
  },
  {
    id: 'calc1-q2',
    type: 'multiple-choice',
    questionText: '\\text{Determine the first derivative of } f(x) = 5x^3',
    options: { A: '5x^2', B: '15x^2', C: '15x^3', D: '3x^5' },
    correctAnswer: 'B',
    set: 'initial',
    rule: ['Power Rule', 'Constant Multiple Rule'],
    recommendation: "Multiply the coefficient by the original exponent.",
    prerequisite: "Multiplication of integers.",
    calculationSlip: "Forgot to multiply the coefficient (5) by the power (3).",
    conceptualGap: "Treating the coefficient as a constant that should go to zero."
  },
  {
    id: 'calc1-q3',
    type: 'multiple-choice',
    questionText: '\\text{Determine the first derivative of } f(x) = 12',
    options: { A: '12', B: '1', C: '0', D: 'undefined' },
    correctAnswer: 'C',
    set: 'initial',
    rule: ['Constant Rule'],
    recommendation: "Remember the derivative of any constant value is always zero.",
    prerequisite: "Definition of a constant function.",
    calculationSlip: "Treated 12 as $12x^1$.",
    conceptualGap: "Assuming all derivatives must retain the original number."
  },
  {
    id: 'calc1-q4',
    type: 'multiple-choice',
    questionText: '\\text{Determine the first derivative of } f(x) = x^4 + 3x^2',
    options: { A: '4x^3 + 6x', B: '4x^3 + 3x', C: 'x^3 + 6x', D: '4x^4 + 6x^2' },
    correctAnswer: 'A',
    set: 'initial',
    rule: ['Sum Rule', 'Power Rule'],
    recommendation: "Differentiate each term in the polynomial independently.",
    prerequisite: "Linearity of derivatives.",
    calculationSlip: "Differentiated the first term but left the second as $3x^2$.",
    conceptualGap: "Misapplying the Sum rule by trying to combine terms before deriving."
  },
  {
    id: 'calc1-q5',
    type: 'multiple-choice',
    questionText: '\\text{Determine the first derivative of } f(x) = \\sqrt{x}',
    options: { A: '\\frac{1}{2\\sqrt{x}}', B: '\\frac{1}{\\sqrt{x}}', C: '2\\sqrt{x}', D: 'x^{-1}' },
    correctAnswer: 'A',
    set: 'initial',
    rule: ['Power Rule'],
    recommendation: "Rewrite radicals as fractional exponents ($x^{1/2}$) before using the power rule.",
    prerequisite: "Laws of Exponents (Radicals).",
    calculationSlip: "Incorrectly calculating $1/2 - 1 = 1/2$.",
    conceptualGap: "Inability to apply the power rule to non-integer exponents."
  },
  {
    id: 'calc1-q6',
    type: 'multiple-choice',
    questionText: '\\text{Determine the first derivative of } f(x) = 3x^{-2}',
    options: { A: '-6x^{-3}', B: '-6x^{-1}', C: '6x^3', D: '-5x^{-3}' },
    correctAnswer: 'A',
    set: 'initial',
    rule: ['Power Rule'],
    recommendation: "Be careful when subtracting 1 from a negative exponent (e.g., $-2 - 1 = -3$).",
    prerequisite: "Negative number arithmetic.",
    calculationSlip: "Calculating $-2 - 1$ as $-1$.",
    conceptualGap: "Number line directional error during subtraction."
  },
  {
    id: 'calc1-q7',
    type: 'multiple-choice',
    questionText: '\\text{Determine the first derivative of } f(x) = \\frac{1}{x^3}',
    options: { A: '-3x^{-4}', B: '3x^{-4}', C: '-\\frac{1}{x^4}', D: '-3x^2' },
    correctAnswer: 'A',
    set: 'initial',
    rule: ['Power Rule'],
    recommendation: "Convert the fraction to a negative exponent ($x^{-3}$) first.",
    prerequisite: "Reciprocal exponent rules.",
    calculationSlip: "Leaving the $x^3$ in the denominator while putting -3 on top.",
    conceptualGap: "Mistaking $1/x^n$ for a logarithmic derivative."
  },
  {
    id: 'calc1-q8',
    type: 'multiple-choice',
    questionText: '\\text{Determine the first derivative of } f(x) = (x^2+1)^2',
    options: { A: '4x(x^2+1)', B: '2(x^2+1)', C: '4x^3', D: '2x^2+2' },
    correctAnswer: 'A',
    set: 'initial',
    rule: ['Chain Rule', 'Power Rule'],
    recommendation: "Apply the Chain Rule: Derivative of the outside $\\times$ Derivative of the inside.",
    prerequisite: "Composite functions.",
    calculationSlip: "Forgot to multiply by the derivative of the inside ($2x$).",
    conceptualGap: "Treating the parentheses as a simple variable."
  },
  {
    id: 'calc1-q9',
    type: 'multiple-choice',
    questionText: '\\text{Determine the first derivative of } f(x) = 4x - \\pi',
    options: { A: '4', B: '4 - 1', C: '4 - \\pi', D: '0' },
    correctAnswer: 'A',
    set: 'initial',
    rule: ['Power Rule', 'Constant Rule'],
    recommendation: "Recognize that $\\pi$ is a constant, just like any number.",
    prerequisite: "Identifying mathematical constants.",
    calculationSlip: "Retaining the $\\pi$ in the result.",
    conceptualGap: "Treating Greek symbols as variables instead of constants."
  },
  {
    id: 'calc1-q10',
    type: 'multiple-choice',
    questionText: '\\text{Determine the first derivative of } f(x) = \\frac{1}{2}x^8',
    options: { A: '4x^7', B: '8x^7', C: '4x^8', D: 'x^7' },
    correctAnswer: 'A',
    set: 'initial',
    rule: ['Power Rule'],
    recommendation: "Multiply the fraction by the power and then reduce the exponent.",
    prerequisite: "Fraction-integer multiplication.",
    calculationSlip: "Miscalculating $1/2 \\times 8$.",
    conceptualGap: "Difficulty deriving terms with fractional coefficients."
  }
];

export const questionSets = [
  {
    id: 'set-1-mixed',
    name: 'SET 1: Initial Diagnostic',
    questions: multipleChoiceQuestions
  }
];

export const questionBankMetadata = {
  course: 'calculus1',
  topic: 'Basic Differentiation Rules'
};

export const getQuestionsBySet = (setType: string) => {
    return multipleChoiceQuestions.filter(q => q.set === setType);
};