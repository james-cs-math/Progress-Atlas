// src/aiService.ts
// Use your existing variable name, but pull the value from the hidden .env file
const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY;
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

// Simple check to make sure it's working
if (!GROQ_API_KEY) {
  console.error("GROQ_API_KEY is missing! Make sure it is in your .env file and starts with VITE_");
}

export const aiService = {
  async ask(course: string, topic: string, type: string, count: number) {

    const prompt = `
You are a world-class math professor and JSON API. Your ONLY output is a valid JSON object — no prose, no markdown, no code fences, no explanation outside JSON.

Generate ${count} question(s) for the course "${course}" on the topic "${topic}".
Question type: "${type}"

━━━━━━━━━━━━━━━━━━━━━━
STRICT MATH QUESTION GENERATION SYSTEM
━━━━━━━━━━━━━━━━━━━━━━

You are a deterministic mathematical question generator.

Your output must always be:
- mathematically correct
- internally consistent
- fully LaTeX-compliant
- JSON-valid
- logically verified before output

━━━━━━━━━━━━━━━━━━━━━━
LATEX RULES (CRITICAL)
━━━━━━━━━━━━━━━━━━━━━━
1. ALL mathematical expressions MUST be wrapped in $...$

   CORRECT:
   "Solve $x^2 + 2x + 1$"

   INCORRECT:
   "Solve x^2 + 2x + 1"

2. EVERY math expression (question, options, explanation) MUST use LaTeX.

3. NEVER use Unicode math symbols:
   × ÷ √ π ∑ → NOT allowed

4. ALL LaTeX must be JSON-escaped:
   \frac → \\frac
   \sqrt → \\sqrt
   \int → \\int
   \sum → \\sum
   \pi → \\pi
   \cdot → \\cdot

5. Example:
   "questionText": "Simplify $\\\\frac{3}{4} + \\\\frac{1}{2}$"

━━━━━━━━━━━━━━━━━━━━━━
MATHEMATICAL CONSISTENCY RULES (CRITICAL)
━━━━━━━━━━━━━━━━━━━━━━
- Solve the problem FIRST before generating any JSON.
- Show internal computation mentally before output.
- The correctAnswer MUST match the computed result exactly.
- The correctAnswer MUST appear inside options (MCQ only).
- ALL incorrect options must be:
  • plausible
  • mathematically related
  • but strictly incorrect

- NEVER guess.
- If multiple methods exist, choose the simplest correct one.
- Always fully simplify expressions before final answer.

━━━━━━━━━━━━━━━━━━━━━━
FINAL VALIDATION CHECK (MANDATORY)
━━━━━━━━━━━━━━━━━━━━━━
Before outputting JSON, verify:

1. Correct answer is mathematically verified
2. correctAnswer exists in options (if multiple-choice)
3. No duplicated correct options
4. All math uses $...$
5. All LaTeX is properly escaped
6. No missing or empty explanation
7. No contradictions between steps and final answer

If ANY check fails → recompute before output.

━━━━━━━━━━━━━━━━━━━━━━
QUESTION TYPE RULES
━━━━━━━━━━━━━━━━━━━━━━

TYPE: multiple-choice
- Provide exactly 4 options: "A", "B", "C", "D"
- Only ONE correct answer
- correctAnswer must be exactly one of A/B/C/D

TYPE: true-false
- questionText must be a statement only (NO True/False inside it)
- options must be:
  { "A": "True", "B": "False" }
- correctAnswer must be "A" or "B"

TYPE: identification
- options = {}
- correctAnswer = exact final result (use LaTeX if needed)

TYPE: solution-based
- options = {}
- correctAnswer = final simplified result (LaTeX allowed)
- explanation MUST show full step-by-step derivation

━━━━━━━━━━━━━━━━━━━━━━
REQUIRED JSON OUTPUT FORMAT
━━━━━━━━━━━━━━━━━━━━━━
Return ONLY this JSON structure:

{
  "questions": [
    {
      "questionText": "string",
      "answerFormat": "multiple-choice | true-false | identification | solution-based",
      "options": {
        "A": "string",
        "B": "string",
        "C": "string",
        "D": "string"
      },
      "correctAnswer": "A",
      "explanation": "string (must not be empty)"
    }
  ]
}

━━━━━━━━━━━━━━━━━━━━━━
STRICT OUTPUT RULE
━━━━━━━━━━━━━━━━━━━━━━
- Output ONLY valid JSON
- No markdown
- No extra text
- No commentary`;

    try {
      const response = await fetch(GROQ_URL, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          messages: [
            {
              role: "system",
              content: "You are a math JSON engine. You only output valid JSON. You vary numbers significantly every time. For true-false questions, questionText must ONLY contain the statement — never include 'A True B False' or any answer options inside the question text."
            },
            { role: "user", content: prompt }
          ],
          temperature: 0.8,
          response_format: { type: "json_object" }
        })
      });

      if (!response.ok) return [];
      const data = await response.json();
      const content = data.choices[0].message.content;
      const parsed = JSON.parse(content);
      const questions = parsed.questions || (Array.isArray(parsed) ? parsed : [parsed]);
      // Ensure explanation is never blank
      return questions.map((q: any) => ({
        ...q,
        explanation: q.explanation || q.solution || q.reasoning || q.rationale || "See the correct answer above.",
      }));
    } catch (err) {
      console.error("AI Service Error:", err);
      return [];
    }
  }
};
