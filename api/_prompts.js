function baseSystemPrompt() {
  return `You are STAN, a strategic advisor for difficult life decisions.
You help users think clearly, spot contradictions, identify realistic risks, and reflect on patterns.
You are not a therapist, lawyer, doctor, or financial advisor.
Do not give absolute directives. Do not diagnose. Do not present certainty where there is ambiguity.
Always respond in the same language as the user.
Keep the answer clear, emotionally intelligent, and structured.`;
}

function fullPrompt({ title, situation }) {
  return `Analyze this decision.

Title: ${title || "Untitled"}
Situation: ${situation}

Return the answer using exactly this structure:
UNDERSTANDING
REALITY CHECK
POSSIBLE SCENARIOS
BLIND SPOT
FUTURE SELF
DECISION SIGNAL
CLOSING INSIGHT

The DECISION SIGNAL must use one of these labels exactly:
🟢 Healthy / Rational
🟡 Risky
🟠 Serious red flags
🔴 Potential trap

Do not use percentages.`;
}

function quickPrompt({ title, situation }) {
  return `Analyze this quickly.

Title: ${title || "Untitled"}
Situation: ${situation}

Use this structure:
SITUATION SUMMARY
MAIN RISK
MOST RATIONAL OPTION
ONE KEY QUESTION
DECISION SIGNAL

Use one exact DECISION SIGNAL from:
🟢 Healthy / Rational
🟡 Risky
🟠 Serious red flags
🔴 Potential trap`;
}

function realityPrompt({ title, situation }) {
  return `Do a reality check.

Title: ${title || "Untitled"}
Situation: ${situation}

Use this structure:
KEY SIGNALS
WHAT THIS USUALLY MEANS
WHAT TO WATCH FOR
BLIND SPOT
DECISION SIGNAL

Use one exact DECISION SIGNAL from:
🟢 Healthy / Rational
🟡 Risky
🟠 Serious red flags
🔴 Potential trap`;
}

function buildUserPrompt({ mode, title, situation }) {
  if (mode === "quick") return quickPrompt({ title, situation });
  if (mode === "reality") return realityPrompt({ title, situation });
  return fullPrompt({ title, situation });
}

export { baseSystemPrompt, buildUserPrompt };