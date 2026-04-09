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
LATEX RULES (CRITICAL)
━━━━━━━━━━━━━━━━━━━━━━
All mathematical expressions MUST use LaTeX. Follow these rules exactly:

1. Wrap every math expression in single dollar signs: $expression$
   CORRECT:   "Find the value of $x^2 + 2x + 1$"
   INCORRECT: "Find the value of x^2 + 2x + 1"

2. Inside a JSON string, every backslash must be DOUBLED (escaped):
   LaTeX \\frac → JSON string "\\\\frac"
   LaTeX \\sqrt → JSON string "\\\\sqrt"
   LaTeX \\int  → JSON string "\\\\int"
   LaTeX \\sum  → JSON string "\\\\sum"
   LaTeX \\cdot → JSON string "\\\\cdot"
   LaTeX \\pi   → JSON string "\\\\pi"

3. Example of a correctly escaped fraction in JSON:
   "questionText": "Simplify $\\\\frac{3}{4} + \\\\frac{1}{2}$"

4. Never use plain Unicode math symbols (×, ÷, √, π, ∑). Use LaTeX commands instead.

━━━━━━━━━━━━━━━━━━━━━━
QUESTION TYPE RULES
━━━━━━━━━━━━━━━━━━━━━━
${type === "multiple-choice" ? `
TYPE: multiple-choice
- Provide exactly 4 options: keys "A", "B", "C", "D"
- Each option value must be a string (may include LaTeX)
- correctAnswer must be exactly one of: "A", "B", "C", or "D"
- Only ONE option should be correct` : ""}

${type === "true-false" ? `
TYPE: true-false
CRITICAL RULES — READ CAREFULLY:
- The questionText must be a STATEMENT (not a question), which is either true or false.
- NEVER mention "True", "False", "A", or "B" anywhere inside questionText. The question text is ONLY the mathematical statement itself.
- BAD example:  "The derivative of $x^2$ is $2x$. A True, B False"  ← NEVER do this
- GOOD example: "The derivative of $x^2$ is $2x$"                  ← statement only, no options
- options must be exactly: {"A": "True", "B": "False"}
- correctAnswer must be exactly "A" or "B"` : ""}

${type === "identification" ? `
TYPE: identification
- options must be an empty object: {}
- correctAnswer is the exact value, formula, or term (use LaTeX if math)
- Keep the answer concise (a word, symbol, or short expression)` : ""}

${type === "solution-based" ? `
TYPE: solution-based
- options must be an empty object: {}
- correctAnswer is the final numeric or algebraic result (use LaTeX)
- explanation must show each step of the derivation clearly, using LaTeX for all math` : ""}

━━━━━━━━━━━━━━━━━━━━━━
REQUIRED JSON STRUCTURE
━━━━━━━━━━━━━━━━━━━━━━
Output this exact structure and nothing else.
The "explanation" field is REQUIRED and must NEVER be empty — always provide a full explanation of why the answer is correct.

{
  "questions": [
    {
      "questionText": "The full question or statement goes here",
      "answerFormat": "${type}",
      "options": { "A": "True", "B": "False" },
      "correctAnswer": "A",
      "explanation": "A full explanation of why the answer is correct goes here. This field must not be empty."
    }
  ]
}

Reminder: output ONLY the JSON object. No text before or after it.
`;

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