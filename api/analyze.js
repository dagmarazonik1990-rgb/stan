function sanitizeLabel(s, maxLen = 70){
  const x = String(s || "")
    .replace(/\s+/g, " ")
    .replace(/^[-–—•\s]+/, "")
    .trim();
  if(!x) return "";
  return x.length > maxLen ? x.slice(0, maxLen - 1).trim() + "…" : x;
}

function extractOptionsAB(text){
  const t = String(text || "");
  const lines = t.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);

  function matchLine(line, key){
    const re = new RegExp(
      String.raw`^(?:opcja\s*)?${key}\s*(?:[:\)\.\-–—])\s*(.+)$`,
      "i"
    );
    const m = line.match(re);
    return m ? sanitizeLabel(m[1]) : "";
  }

  let a = "";
  let b = "";
  for(const line of lines){
    if(!a) a = matchLine(line, "A");
    if(!b) b = matchLine(line, "B");
  }

  if(!a || !b){
    const inline = t.replace(/\r?\n/g, " ");
    const reInlineA = /(?:^|\s)(?:opcja\s*)?A\s*[:\)\.\-–—]\s*(.+?)(?=\s+(?:opcja\s*)?B\s*[:\)\.\-–—]\s*)/i;
    const reInlineB = /(?:^|\s)(?:opcja\s*)?B\s*[:\)\.\-–—]\s*(.+)$/i;
    const ma = inline.match(reInlineA);
    const mb = inline.match(reInlineB);
    if(!a && ma) a = sanitizeLabel(ma[1]);
    if(!b && mb) b = sanitizeLabel(mb[1]);
  }

  if(!a && !b) return null;
  return { labelA: a || "A", labelB: b || "B" };
}

function estimateDataConfidence(text){
  const t = String(text||"");
  const hasConstraints = /(czas|termin|budżet|pieniądz|kasa|koszt|energia|ryzyk|limit|deadline|zdrow)/i.test(t);
  const hasGoal = /(chcę|cel|osiągnąć|zależy mi|moim celem|chodzi o to)/i.test(t);
  const hasContext = t.length >= 180;
  const hasOptions = extractOptionsAB(t) !== null;

  let score = 0;
  if(hasOptions) score++;
  if(hasGoal) score++;
  if(hasConstraints) score++;
  if(hasContext) score++;

  if(score <= 1) return "NISKIE";
  if(score === 2) return "ŚREDNIE";
  return "WYSOKIE";
}

function estimateChaos(text){
  const t = String(text||"");
  const ab = extractOptionsAB(t);
  const data = estimateDataConfidence(t);

  // heurystyka chaosu: brak danych + sprzeczne sygnały + presja
  const pressure = /(natychmiast|już|teraz|pilne|deadline|muszę|nie mogę|boję|panik)/i.test(t) ? 1 : 0;
  const ambiguity = /(nie wiem|chyba|może|jakoś|trudno|mam mętlik|chaos)/i.test(t) ? 1 : 0;
  const conflict = /(z jednej strony|z drugiej strony|ale jednocześnie|konflikt|sprzeczne)/i.test(t) ? 1 : 0;

  let base =
    data === "WYSOKIE" ? 35 :
    data === "ŚREDNIE" ? 55 : 72;

  if(!ab) base += 6;
  base += pressure*8 + ambiguity*7 + conflict*8;

  base = Math.max(10, Math.min(95, Math.round(base)));

  const explainParts = [];
  if(data === "NISKIE") explainParts.push("Mało danych → rośnie chaos decyzyjny.");
  if(!ab) explainParts.push("Brak jawnych opcji A/B → trudniej domknąć wybór.");
  if(pressure) explainParts.push("Jest presja czasu/emocji → łatwo o błąd.");
  if(ambiguity) explainParts.push("W opisie jest niepewność → potrzebne kryteria.");
  if(conflict) explainParts.push("Widać konflikt wartości → trzeba priorytetu.");

  const explain = explainParts.join(" ");

  return { score: base, explain: explain || "Chaos wynika głównie z poziomu danych i presji sytuacji." };
}

function demoReply(userText, mode="full"){
  const t = (userText || "").trim();
  const ab = extractOptionsAB(t);
  const dataConfidence = estimateDataConfidence(t);
  const chaos = estimateChaos(t);

  const base = {
    decision: {
      labelA: ab?.labelA || "A",
      labelB: ab?.labelB || "B",
      choice: "NONE",
      confidence: 50,
      explain: "DEMO nie wydaje wyboru. W planie płatnym dostaniesz wynik 0–100% + uzasadnienie."
    },
    chaos,
    card: {
      archetype: "STRATEG",
      dataConfidence,
      line: "Nie brakuje Ci odwagi — brakuje Ci kryteriów.",
      mission: "Misja 24h: wypisz 3 kryteria (czas/koszt/ryzyko) i ustaw godzinę decyzji."
    },
    analysis:
      "DEMO:\n" +
      "• Fakty vs interpretacje\n" +
      "• Cel\n" +
      "• Ograniczenia\n" +
      "• Opcje A/B\n",
    risk:
      "DEMO: ocena ogólna: średnie.\n" +
      "Jeśli temat dotyczy zdrowia/prawa/bezpieczeństwa — to nie jest porada specjalisty.",
    recommendation:
      "24h: dopisz kryteria + 1 mikro-test.\n" +
      "7 dni: zbierz dane.\n" +
      "30 dni: wybierz kierunek i iteruj.\n",
    simulation: ""
  };

  if(mode === "quick"){
    base.analysis = "DEMO: szybka decyzja wymaga planu płatnego.";
    base.recommendation = "Podaj A/B + 3 kryteria (czas/koszt/ryzyko).";
  }

  if(mode === "simulate" || mode === "confront"){
    base.analysis = "To jest tryb PRO.";
    base.recommendation = "Odblokuj PRO, aby użyć symulacji lub konfrontacji.";
  }

  if(t.length < 60){
    base.card.line = "Brakuje danych do karty.";
    base.card.mission = "Misja 24h: dopisz cel, ograniczenia oraz A/B.";
  }

  return base;
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    const { text, tier, profile, mode } = req.body || {};
    const userText = String(text || "").trim();
    const m = String(mode || "full"); // full|quick|simulate|confront
    const isPro = tier === "pro";
    const isPaid = tier === "pro" || tier === "stan";

    // DEMO always allowed (no OpenAI)
    if (!tier || tier === "demo") {
      return res.status(200).json(demoReply(userText, m));
    }

    // PRO-only mode enforcement (server-side)
    if ((m === "simulate" || m === "confront") && !isPro) {
      return res.status(200).json({
        ...demoReply(userText, m),
        analysis: "Ten tryb jest dostępny w PRO.",
        recommendation: "Odblokuj PRO, aby użyć symulacji lub konfrontacji."
      });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "Missing OPENAI_API_KEY" });

    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

    const p = profile || {};
    const profileBlock =
      `Profil użytkownika:\n` +
      `- styl: ${p.style || "nieznany"}\n` +
      `- ryzyko: ${p.risk || "nieznane"}\n` +
      `- obszar: ${p.area || "ogólne"}\n`;

    const ab = extractOptionsAB(userText);
    const dataConfidence = estimateDataConfidence(userText);
    const chaos = estimateChaos(userText);

    const abHint = ab
      ? `Opcje wykryte:\nA = ${ab.labelA}\nB = ${ab.labelB}\n`
      : `Brak jawnych opcji A/B. Jeśli to wybór, poproś o dopisanie A: ... / B: ...\n`;

    const tone =
      m === "confront"
        ? "Konfrontuj niekonkretność. Bądź bezlitosny dla wymówek, ale nie agresywny wobec osoby."
        : "Bądź życzliwie stanowczy. Zero lania wody.";

    const lengthSpec =
      m === "quick" ? "krótko (150–320 słów)" :
      m === "simulate" ? "średnio (450–800 słów) + symulacja" :
      "długo (300–1000 słów)";

    const system = `
Jesteś STAN — strategiczny doradca życia i agent decyzyjny.
Brzmisz jak prawdziwe AI: konkretnie, spokojnie, profesjonalnie. ${tone}
Nie bądź chamski. Nie stawiaj diagnoz medycznych/psychologicznych ani prawnych/finansowych.
Jeśli temat dotyczy zdrowia/prawa/bezpieczeństwa: zaznacz ograniczenia i zasugeruj konsultację.
Mów w pierwszej osobie. Oddziel fakty od interpretacji.

Zwracasz WYŁĄCZNIE czysty JSON:
{
  "decision": { "labelA":"…","labelB":"…","choice":"A|B|NONE","confidence":0-100,"explain":"…" },
  "chaos": { "score": 0-100, "explain": "…" },
  "card": { "archetype":"…","dataConfidence":"NISKIE|ŚREDNIE|WYSOKIE","line":"…","mission":"…" },
  "analysis":"…",
  "risk":"…",
  "recommendation":"…",
  "simulation":"…" // tylko gdy mode=simulate
}

Archetypy (wybierz 1):
STRATEG / WOJOWNIK / ANARCH / KONSERWATOR / EMPAT / ANALITYK / RYZYKANT / REALISTA

Zasady:
- decision.confidence: jak mocno dane wskazują na choice (A lub B). Jeśli brak danych → choice="NONE", confidence=50.
- card.line: jedno mocne zdanie (nie chamskie, bez diagnoz).
- card.mission: jedna mikro-misja na 24h (konkret).
- card.dataConfidence: użyj podanego poziomu danych.

Tryby:
- full: analiza 360° + ryzyko + plan 24h/7/30.
- quick: maksymalnie konkret (krócej), decyzja + 3 powody + 1 mikro-krok.
- simulate: dodatkowo 'simulation' porównujące A i B dla 30 dni / 6 miesięcy / 2 lata (krótko, konkret).
- confront: pokaż sedno i mechanizm uniku, ale zawsze zostaw plan.

Długość: ${lengthSpec}.
`.trim();

    const prompt = `
${profileBlock}

Poziom danych: ${dataConfidence}
Chaos (wstępnie): ${chaos.score}/100

${abHint}

Opis użytkownika:
"""${userText}"""

Tryb: ${m}
`.trim();

    const r = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        input: [
          { role: "system", content: system },
          { role: "user", content: prompt }
        ],
        temperature: m === "confront" ? 0.7 : (m === "quick" ? 0.45 : 0.6),
        max_output_tokens: m === "quick" ? 900 : 1800
      })
    });

    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: data?.error?.message || "OpenAI error" });

    const outText = String(data.output_text || "").trim();

    let parsed = null;
    try { parsed = JSON.parse(outText); }
    catch {
      const first = outText.indexOf("{");
      const last = outText.lastIndexOf("}");
      if(first >= 0 && last > first) parsed = JSON.parse(outText.slice(first, last + 1));
    }

    if (!parsed || typeof parsed !== "object") {
      return res.status(200).json(demoReply(userText, m));
    }

    // Decision hardening
    const decisionIn = (parsed.decision && typeof parsed.decision === "object") ? parsed.decision : {};
    const choiceRaw = String(decisionIn.choice || "NONE").toUpperCase();
    const confidenceRaw = Number(decisionIn.confidence);
    const confidence = Number.isFinite(confidenceRaw) ? Math.max(0, Math.min(100, Math.round(confidenceRaw))) : 50;

    const labelA = sanitizeLabel(decisionIn.labelA || "") || (ab?.labelA || "A");
    const labelB = sanitizeLabel(decisionIn.labelB || "") || (ab?.labelB || "B");

    const decision = {
      labelA, labelB,
      choice: (choiceRaw === "A" || choiceRaw === "B" || choiceRaw === "NONE") ? choiceRaw : "NONE",
      confidence,
      explain: String(decisionIn.explain || "").trim()
    };

    // If no A/B in input and model tried to pick, force NONE
    if(!ab && (decision.choice === "A" || decision.choice === "B")){
      decision.choice = "NONE";
      decision.confidence = 50;
      if(!decision.explain) decision.explain = "Nie podałaś jasno opcji A/B. Dopisz je (A: … / B: …), a dam wynik 0–100%."
    }

    // Chaos hardening: always use server heuristic as base, allow model to add explain only
    const chaosIn = (parsed.chaos && typeof parsed.chaos === "object") ? parsed.chaos : {};
    const chaosExplain = String(chaosIn.explain || "").trim();
    const chaosOut = { score: chaos.score, explain: chaosExplain || chaos.explain };

    // Card hardening
    const cardIn = (parsed.card && typeof parsed.card === "object") ? parsed.card : {};
    const archetype = sanitizeLabel(cardIn.archetype || "REALISTA", 24).toUpperCase();
    const allowed = new Set(["STRATEG","WOJOWNIK","ANARCH","KONSERWATOR","EMPAT","ANALITYK","RYZYKANT","REALISTA"]);
    const safeArchetype = allowed.has(archetype) ? archetype : "REALISTA";

    const card = {
      archetype: safeArchetype,
      dataConfidence,
      line: String(cardIn.line || "").trim() || "Nie chodzi o idealny wybór. Chodzi o ruch.",
      mission: String(cardIn.mission || "").trim() || "Misja 24h: wybierz 1 krok, który zmniejsza ryzyko i zwiększa opcje."
    };

    const analysis = String(parsed.analysis || "").trim() || "—";
    const risk = String(parsed.risk || "").trim() || "—";
    const recommendation = String(parsed.recommendation || "").trim() || "—";

    let simulation = "";
    if(m === "simulate"){
      simulation = String(parsed.simulation || "").trim();
      if(!simulation){
        simulation =
          "30 dni:\nA: —\nB: —\n\n6 miesięcy:\nA: —\nB: —\n\n2 lata:\nA: —\nB: —";
      }
    }

    return res.status(200).json({
      decision,
      chaos: chaosOut,
      card,
      analysis,
      risk,
      recommendation,
      simulation
    });

  } catch (err) {
    return res.status(500).json({ error: String(err?.message || err) });
  }
}