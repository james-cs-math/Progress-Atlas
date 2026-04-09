// src/aiService.ts
const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY;
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

if (!GROQ_API_KEY) {
  console.error("GROQ_API_KEY is missing! Make sure it is in your .env file and starts with VITE_");
}

// ─────────────────────────────────────────────────────────────────
// GRADING HELPERS
// ─────────────────────────────────────────────────────────────────

export function normalizeAnswer(raw: string): string {
  return (
    raw
      .trim()
      .replace(/^\$\$?([\s\S]*?)\$\$?$/, "$1")
      .replace(/\s+/g, "")
      .toLowerCase()
  );
}

export function answersMatch(userAnswer: string, correctAnswer: string): boolean {
  return normalizeAnswer(userAnswer) === normalizeAnswer(correctAnswer);
}

// ─────────────────────────────────────────────────────────────────
// LATEX REPAIR
//
// llama-3.1-8b-instant emits bare LaTeX backslashes inside JSON strings,
// e.g. "$\frac{3}{2}$". JSON treats \f as a form-feed — either a parse
// error or a silently dropped backslash, both of which break rendering.
//
// This function walks the raw string BEFORE JSON.parse and doubles any
// lone backslash that isn't part of a valid JSON escape sequence.
// ─────────────────────────────────────────────────────────────────
function repairLatexInJsonString(raw: string): string {
  const VALID_JSON_ESCAPES = new Set(['"', '\\', 'n', 't', 'r', '/', 'b', 'f']);
  let out = "";
  let i = 0;
  const len = raw.length;

  while (i < len) {
    if (raw[i] !== '"') { out += raw[i++]; continue; }

    // Enter a JSON string
    out += '"';
    i++;

    while (i < len) {
      const ch = raw[i];

      if (ch === '"') { out += '"'; i++; break; }  // end of string

      if (ch === "\\") {
        const next = i + 1 < len ? raw[i + 1] : "";
        if (next === "\\") {
          // Already doubled \\
          out += "\\\\"; i += 2;
        } else if (VALID_JSON_ESCAPES.has(next)) {
          // Recognised JSON escape: \", \n, \t, \r, \/, \b, \f
          out += ch + next; i += 2;
        } else if (next === "u" && i + 5 < len) {
          // Unicode escape \uXXXX
          out += raw.slice(i, i + 6); i += 6;
        } else {
          // Bare LaTeX backslash — double it so JSON.parse preserves it
          out += "\\\\"; i++;
        }
        continue;
      }

      out += ch; i++;
    }
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────
// PROMPT BUILDER — one type block injected per request
// ─────────────────────────────────────────────────────────────────
function buildPrompt(course: string, topic: string, type: string, count: number): string {

  const latexRules = `
LATEX ENCODING — NON-NEGOTIABLE
• Wrap EVERY math expression in single dollar signs: $expression$
• Every LaTeX backslash MUST be written as TWO backslashes inside a JSON string:
    \\frac  →  \\\\frac      \\sqrt  →  \\\\sqrt
    \\lim   →  \\\\lim       \\to    →  \\\\to
    \\int   →  \\\\int       \\sum   →  \\\\sum
    \\infty →  \\\\infty     \\pi    →  \\\\pi
    \\cdot  →  \\\\cdot      \\times →  \\\\times
• Correct example:  "Find $\\\\lim_{x \\\\to 2}(x^2 - 1)$"
• NEVER use Unicode math symbols (×  ÷  √  π  ∑  ∞  ≠  ≤  ≥). Use LaTeX only.
`;

  const outputRules = `
OUTPUT FORMAT — NON-NEGOTIABLE
• Output ONLY the raw JSON object. Nothing before it. Nothing after it.
• No markdown code fences, no comments, no prose outside JSON.
• NEVER use box-drawing characters (─ │ ┌ ┐ └ ┘ ━ ┃ ═ ╔ etc.) anywhere.
• NEVER use asterisks or markdown formatting inside string values.
`;

  const accuracyRules = `
MATHEMATICAL ACCURACY — NON-NEGOTIABLE
1. Solve the problem fully before writing ANY field.
2. correctAnswer = the exact, fully simplified computed result.
3. The correct option's VALUE must equal the fully simplified result.
4. explanation must CONFIRM correctAnswer is right. It must NEVER contradict it.
5. Re-check: correctAnswer, correct option value, and explanation must all agree.

Simplification rules:
• Reduce all fractions: $\\\\frac{4}{1}$ → write as $4$ (not as a fraction)
• $\\\\frac{6}{3}$ → $2$,  $\\\\frac{0}{x}$ → $0$
• For removable discontinuities (like $\\\\frac{x^2-4}{x-2}$ at x=2), factor and cancel — never give ∞.
• ALL option values must be formatted consistently — if any uses $...$, ALL must use $...$.
`;

  const typeRules: Record<string, string> = {

    "multiple-choice": `
TYPE: multiple-choice
• options: exactly 4 keys "A" "B" "C" "D". Each value is a plain string.
• correctAnswer: exactly ONE letter — "A", "B", "C", or "D".
• The correct option's value MUST equal the fully simplified result.
• The other three options must be plausible wrong answers.
• ALL four values must use the same format (all plain, or all wrapped in $...$).
• NEVER put "True", "False", "Yes", "No" as option values.
• NEVER include the letter inside the value string (never "A. 5", just "5").
`,

    "true-false": `
TYPE: true-false
• questionText: a math STATEMENT (not a question) — true or false.
  Must NOT contain "True", "False", "A", or "B".
  GOOD: "The derivative of $x^2$ is $2x$"
  BAD:  "Is the derivative of $x^2$ equal to $2x$? A. True  B. False"
• options: exactly { "A": "True", "B": "False" }.
• correctAnswer: "A" if statement is true, "B" if false.
`,

    "identification": `
TYPE: identification
• questionText: fill-in-the-blank or direct question with one specific answer.
• options: empty object {}.
• correctAnswer:
  - Math expression → wrap in $...$, e.g. "$x^2 + 1$" or "$\\\\frac{1}{2}$"
  - Plain word or integer → no dollar signs, e.g. "parabola" or "5"
  - NEVER empty. NEVER "Yes", "No", "True", "False".
• explanation: explain why that specific term or value is correct.
`,

    "solution-based": `
TYPE: solution-based
• questionText: a math problem requiring a full worked solution.
• options: empty object {}.
• correctAnswer: final simplified result ONLY — no steps, no prose.
  - Wrap in $...$ if mathematical. Simplify completely ($\\\\frac{4}{1}$ → $4$).
• explanation: show every step with LaTeX. Last sentence must confirm the answer equals correctAnswer.
  NEVER express doubt about the answer.
`,
  };

  const selectedTypeRules =
    typeRules[type] ??
    `TYPE: ${type}\noptions: {}\ncorrectAnswer: the exact answer as a string.\n`;

  const schema = `
OUTPUT STRUCTURE:
{
  "questions": [
    {
      "questionText":  "<the question or statement>",
      "answerFormat":  "${type}",
      "options":       <per type rules>,
      "correctAnswer": "<per type rules>",
      "explanation":   "<non-empty — CONFIRMS correctAnswer is correct>"
    }
  ]
}`;

  return `
You are a precise math question generator. Output ONLY valid JSON.
Course: "${course}"   Topic: "${topic}"   Type: "${type}"   Count: ${count}
${latexRules}
${selectedTypeRules}
${accuracyRules}
${outputRules}
${schema}

Generate exactly ${count} question(s). Output only the JSON.
`.trim();
}

// ─────────────────────────────────────────────────────────────────
// POST-PROCESSING — safety net after parsing
// ─────────────────────────────────────────────────────────────────
function postProcess(questions: any[], type: string): any[] {
  return questions.map((q: any) => {
    const explanation: string = (
      q.explanation || q.solution || q.reasoning || q.rationale || ""
    ).trim();

    let correctAnswer: string = (q.correctAnswer ?? "").trim();

    // Add $...$ if the answer looks mathematical but is missing delimiters
    if (
      (type === "identification" || type === "solution-based") &&
      correctAnswer &&
      !correctAnswer.startsWith("$") &&
      /[+\-*/^=\\{}]/.test(correctAnswer)
    ) {
      correctAnswer = `$${correctAnswer}$`;
    }

    // Simplify trivial fractions the model still writes in fraction form
    correctAnswer = correctAnswer
      .replace(/\$\\frac\{(\d+)\}\{1\}\$/g, "$$$1$")
      .replace(/\$\\frac\{0\}\{[^}]+\}\$/g, "$0$");

    return {
      ...q,
      correctAnswer,
      explanation: explanation || "See the correct answer above.",
    };
  });
}

// ─────────────────────────────────────────────────────────────────
// MAIN SERVICE
// ─────────────────────────────────────────────────────────────────
export const aiService = {
  async ask(course: string, topic: string, type: string, count: number) {
    const prompt = buildPrompt(course, topic, type, count);

    try {
      const response = await fetch(GROQ_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          messages: [
            {
              role: "system",
              content: [
                `You generate ${type} math questions as pure JSON.`,
                "No markdown. No code fences. No prose outside JSON.",
                "No box-drawing characters. No Unicode math symbols.",
                "Solve every problem before writing the answer.",
                "explanation always confirms correctAnswer — never contradicts it.",
                "All option values use the same format (all plain or all LaTeX $...$).",
              ].join(" "),
            },
            { role: "user", content: prompt },
          ],
          temperature: 0.65,
          response_format: { type: "json_object" },
        }),
      });

      if (!response.ok) {
        console.error("Groq API error:", response.status, await response.text());
        return [];
      }

      const data = await response.json();
      const rawContent: string = data.choices[0].message.content;

      // Step 1: strip accidental markdown fences
      const stripped = rawContent.replace(/```json|```/gi, "").trim();

      // Step 2: repair bare LaTeX backslashes before JSON.parse silently drops them
      const repaired = repairLatexInJsonString(stripped);

      let parsed: any;
      try {
        parsed = JSON.parse(repaired);
      } catch (parseErr) {
        console.warn("Repaired JSON failed, falling back to stripped:", parseErr);
        parsed = JSON.parse(stripped);
      }

      const questions: any[] =
        parsed.questions || (Array.isArray(parsed) ? parsed : [parsed]);

      return postProcess(questions, type);
    } catch (err) {
      console.error("AI Service Error:", err);
      return [];
    }
  },
};
