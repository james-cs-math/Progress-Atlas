// src/aiService.ts
const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY;
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

if (!GROQ_API_KEY) {
  console.error("GROQ_API_KEY is missing! Make sure it is in your .env file and starts with VITE_");
}

// ─────────────────────────────────────────────
// GRADING HELPER
// Normalizes a LaTeX/text answer string so that
// minor formatting differences don't cause false negatives.
// ─────────────────────────────────────────────
export function normalizeAnswer(raw: string): string {
  return raw
    .trim()
    // Strip wrapping $...$ or $$...$$ delimiters
    .replace(/^\$\$?([\s\S]*?)\$\$?$/, "$1")
    // Remove all whitespace
    .replace(/\s+/g, "")
    // Lowercase
    .toLowerCase();
}

export function answersMatch(userAnswer: string, correctAnswer: string): boolean {
  return normalizeAnswer(userAnswer) === normalizeAnswer(correctAnswer);
}

// ─────────────────────────────────────────────
// PROMPT BUILDERS — one per question type
// Keeping them separate eliminates cross-type bleed.
// ─────────────────────────────────────────────
function buildPrompt(course: string, topic: string, type: string, count: number): string {
  const latexRules = `
LATEX RULES — NON-NEGOTIABLE
• Every math expression MUST be wrapped in single dollar signs: $expression$
• Inside JSON strings, every backslash MUST be doubled:
    LaTeX \\frac  →  JSON "\\\\frac"
    LaTeX \\sqrt  →  JSON "\\\\sqrt"
    LaTeX \\int   →  JSON "\\\\int"
    LaTeX \\sum   →  JSON "\\\\sum"
    LaTeX \\cdot  →  JSON "\\\\cdot"
    LaTeX \\pi    →  JSON "\\\\pi"
• Example of a correct fraction in JSON:
    "questionText": "Simplify $\\\\frac{3}{4} + \\\\frac{1}{2}$"
• NEVER use plain Unicode math symbols: ×  ÷  √  π  ∑  ≠  ≤  ≥
  Use LaTeX commands instead: \\times  \\div  \\sqrt{}  \\pi  \\sum  \\neq  \\leq  \\geq
• NEVER use markdown, bullet points, asterisks, dashes, or any box-drawing characters
  (─ │ ┌ ┐ └ ┘ ━ ┃ etc.) anywhere in the output — not inside strings, not outside them.
`;

  const outputRules = `
OUTPUT RULES — NON-NEGOTIABLE
• Output ONLY the raw JSON object. No text before it. No text after it.
• No markdown code fences (\`\`\`json ... \`\`\`).
• No comments, no explanations, no preamble.
• The "explanation" field MUST:
    - Be non-empty.
    - Confirm that the correctAnswer IS correct (never contradict it).
    - Show the derivation or reasoning using LaTeX where needed.
    - NOT say the answer is wrong, uncertain, or "could also be".
`;

  const accuracy = `
ACCURACY RULES — NON-NEGOTIABLE
• Solve the problem completely BEFORE writing any field.
• The correctAnswer MUST equal the computed result exactly.
• For multiple-choice: the correct option's value MUST match correctAnswer's key.
• Verify: re-read correctAnswer and explanation — they must agree.
`;

  const schema = `
REQUIRED JSON SCHEMA
{
  "questions": [
    {
      "questionText":  "<string>",
      "answerFormat":  "${type}",
      "options":       <see type rules below>,
      "correctAnswer": "<string>",
      "explanation":   "<non-empty string confirming the correct answer>"
    }
  ]
}
`;

  // ── Type-specific rules ──────────────────────────────────────────────────
  const typeRules: Record<string, string> = {
    "multiple-choice": `
TYPE RULES — multiple-choice ONLY
• options: exactly 4 entries with keys "A", "B", "C", "D". Each value is a string.
• correctAnswer: exactly one of "A", "B", "C", or "D" — the letter only, nothing else.
• Only one option is correct; the other three are plausible but wrong.
• Options MUST NOT include "True" / "False" / "Yes" / "No" as answer choices.
• Options MUST NOT be written as boxes, e.g. [ A ] or (A). Just the value string.
• The correct option's value must exactly match the computed answer.
`,
    "true-false": `
TYPE RULES — true-false ONLY
• questionText: a mathematical STATEMENT that is either true or false.
  - It must NOT be phrased as a question.
  - It must NOT mention "True", "False", "A", or "B" anywhere inside it.
  - GOOD: "The derivative of $x^2$ is $2x$"
  - BAD:  "Is the derivative of $x^2$ equal to $2x$? A. True  B. False"
• options: MUST be exactly { "A": "True", "B": "False" } — no other values.
• correctAnswer: exactly "A" (if the statement is true) or "B" (if false).
`,
    "identification": `
TYPE RULES — identification ONLY
• questionText: a fill-in-the-blank or direct question expecting a specific term/value.
• options: MUST be an empty object {}.
• correctAnswer: the exact answer — a word, symbol, number, or short expression.
  - If the answer is a mathematical expression, wrap it in $...$  e.g. "$x^2 + 1$"
  - If the answer is a plain word or number (e.g. "parabola", "5"), no dollar signs needed.
  - NEVER leave correctAnswer as an empty string.
  - NEVER answer with "Yes", "No", "True", or "False".
• explanation: explain why that specific term or value is the answer.
`,
    "solution-based": `
TYPE RULES — solution-based ONLY
• questionText: a problem requiring a full worked solution (algebra, calculus, etc.).
• options: MUST be an empty object {}.
• correctAnswer: the final simplified result only. Wrap in $...$ if mathematical.
  - Example: "$\\\\frac{1}{2}$" or "$x = 3$" or "6"
  - NEVER include step-by-step work inside correctAnswer — only the final result.
• explanation: show EVERY step of the derivation using LaTeX.
  - The final line of explanation must state that correctAnswer is the result.
  - NEVER say the answer is wrong or express doubt about it.
`,
  };

  const selectedTypeRules = typeRules[type] ?? `TYPE: ${type}\noptions: {}\ncorrectAnswer: the answer as a string.`;

  return `
You are a math question generator that outputs only valid JSON.
Generate ${count} question(s) for the course "${course}" on the topic "${topic}".

${latexRules}

${selectedTypeRules}

${accuracy}

${outputRules}

${schema}

Generate exactly ${count} question(s). Output only the JSON.
`.trim();
}

// ─────────────────────────────────────────────
// LATEX REPAIR
// The model (llama-3.1-8b-instant) frequently produces
// single-escaped backslashes (\frac) in JSON strings instead
// of the required double-escaped form (\\frac). This causes
// the JSON parser to silently drop the backslash, turning
// \frac{3}{2} into frac{3}{2} and \lim into lim — which then
// renders as plain broken text.
//
// Strategy: work on the raw JSON *string* before parsing.
// We find every $...$ block inside a JSON string value and
// re-escape any single backslash that isn't already doubled.
// ─────────────────────────────────────────────

/**
 * Given a raw JSON string from the model, find all LaTeX
 * expressions inside $...$ delimiters and ensure every
 * backslash is properly doubled so JSON.parse won't strip them.
 */
function repairLatexInJsonString(raw: string): string {
  // We operate character-by-character so we can track whether
  // we're inside a JSON string and inside a $...$ block.
  let result = "";
  let i = 0;
  const len = raw.length;

  while (i < len) {
    // ── Enter a JSON string value ──────────────────────────
    if (raw[i] === '"') {
      result += '"';
      i++;
      let inDollar = false;

      while (i < len) {
        const ch = raw[i];

        // End of JSON string (unescaped quote)
        if (ch === '"' && raw[i - 1] !== "\\") {
          result += '"';
          i++;
          break;
        }

        // Track $...$ delimiters (double $$ treated as one unit)
        if (ch === "$") {
          inDollar = !inDollar;
          result += ch;
          i++;
          continue;
        }

        // Inside a LaTeX block — fix single backslashes
        if (inDollar && ch === "\\") {
          const next = raw[i + 1];
          if (next === "\\") {
            // Already doubled — keep as-is and skip both chars
            result += "\\\\";
            i += 2;
          } else {
            // Single backslash — double it so JSON.parse keeps it
            result += "\\\\";
            i++;
          }
          continue;
        }

        result += ch;
        i++;
      }
    } else {
      result += raw[i];
      i++;
    }
  }

  return result;
}

// ─────────────────────────────────────────────
// POST-PROCESSING
// Ensures correctAnswer always has $...$ for math types,
// and explanation never contradicts the answer.
// ─────────────────────────────────────────────
function postProcess(questions: any[], type: string): any[] {
  return questions.map((q: any) => {
    const explanation: string = (
      q.explanation || q.solution || q.reasoning || q.rationale || ""
    ).trim();

    // For identification and solution-based, if correctAnswer looks like a
    // math expression but is missing $...$, wrap it.
    let correctAnswer: string = (q.correctAnswer ?? "").trim();
    if (
      (type === "identification" || type === "solution-based") &&
      correctAnswer &&
      !correctAnswer.startsWith("$") &&
      /[+\-*/^=\\{}]/.test(correctAnswer)
    ) {
      correctAnswer = `$${correctAnswer}$`;
    }

    return {
      ...q,
      correctAnswer,
      explanation: explanation || "See the correct answer above.",
    };
  });
}

// ─────────────────────────────────────────────
// MAIN SERVICE
// ─────────────────────────────────────────────
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
                "You are a math question generator.",
                "You output ONLY valid JSON — no markdown, no code fences, no prose.",
                "You NEVER use box-drawing characters or Unicode symbols in output.",
                "You ALWAYS solve the problem before writing the answer.",
                "Your explanation ALWAYS confirms the correctAnswer is correct.",
                `You are generating questions of type: ${type} — follow ONLY the rules for that type.`,
              ].join(" "),
            },
            { role: "user", content: prompt },
          ],
          temperature: 0.7,
          response_format: { type: "json_object" },
        }),
      });

      if (!response.ok) {
        console.error("Groq API error:", response.status, await response.text());
        return [];
      }

      const data = await response.json();
      const rawContent: string = data.choices[0].message.content;

      // Step 1 — strip accidental markdown fences
      const stripped = rawContent.replace(/```json|```/gi, "").trim();

      // Step 2 — repair single-escaped LaTeX backslashes before JSON.parse
      // silently drops them. Fixes \frac rendering as frac, \lim as lim, etc.
      const repaired = repairLatexInJsonString(stripped);

      let parsed: any;
      try {
        parsed = JSON.parse(repaired);
      } catch (parseErr) {
        console.warn("repaired JSON failed, falling back:", parseErr);
        parsed = JSON.parse(stripped);
      }

      const questions: any[] =
        parsed.questions ||
        (Array.isArray(parsed) ? parsed : [parsed]);

      return postProcess(questions, type);
    } catch (err) {
      console.error("AI Service Error:", err);
      return [];
    }
  },
};
