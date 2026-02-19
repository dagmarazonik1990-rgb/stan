export default async function handler(req, res) {
  // zawsze JSON
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  // tylko POST
  if (req.method !== "POST") {
    return res.status(200).json({
      analysis: "Ten endpoint działa tylko dla POST.",
      risk: "—",
      recommendation: "Wróć do aplikacji i kliknij „Analiza →”."
    });
  }

  // bezpieczne wczytanie body (czasem bywa string)
  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { body = {}; }
  }

  const text = String(body?.text || "").trim();

  if (text.length < 20) {
    return res.status(200).json({
      analysis:
        "Brakuje mi danych. Widzę emocję, ale nie widzę konkretu. Jeśli mam być użyteczny, a nie zgadywać — dopisz 2–3 zdania: co się wydarzyło, czego chcesz i co Cię ogranicza.",
      risk:
        "Ryzyko: jeśli zacznę zgadywać, dostaniesz ładnie brzmiącą bzdurę. A Ty nie przyszłaś tu po bzdury.",
      recommendation:
        "Dopisz: (1) co dokładnie robi ta osoba/sytuacja, (2) co jest Twoim celem, (3) jaka jest Twoja granica (czas/pieniądze/energia)."
    });
  }

  const out = demoStan(text);
  return res.status(200).json(out);
}

/**
 * STAN DEMO (wersja C): wygląda jak AI, ale działa bez API.
 * Cel: mądre pytania + logiczna rama + krótki plan działania.
 */
function demoStan(text) {
  const t = normalize(text);

  const signals = {
    anger: hasAny(t, ["wkur", "kurw", "wredn", "chuj", "mam dość", "złość", "iryt"]),
    fear: hasAny(t, ["boję", "strach", "lęk", "obaw", "panik", "nie dam rady", "co jeśli"]),
    sadness: hasAny(t, ["smut", "przykro", "płacz", "samot", "żal", "rozpad"]),
    overwhelm: hasAny(t, ["zmęcz", "nie wyrabiam", "przytłocz", "chaos", "za dużo", "spięta"]),
    ambition: hasAny(t, ["potencjał", "projekt", "rozwój", "chcę więcej", "ambic", "marzę"]),
    indecision: hasAny(t, ["nie wiem", "zastanawiam", "waha", "może", "chyba", "odkładam", "ciągle analizuję"]),
  };

  const domain =
    hasAny(t, ["partner", "związek", "mąż", "dziewczyna", "chłopak", "relacja", "zdrad"]) ? "relationship" :
    hasAny(t, ["praca", "szef", "firma", "etat", "cv", "rekrut", "wypalen", "kariera"]) ? "work" :
    hasAny(t, ["pieniądz", "kasa", "dług", "rat", "kredyt", "czynsz", "budżet", "bezpieczeństw"]) ? "money" :
    "general";

  const conflict =
    (signals.ambition && (signals.fear || hasAny(t, ["bezpieczeństw", "stabiln", "ryzyk"])))
      ? "bezpieczeństwo vs rozwój"
      : signals.anger && domain === "relationship"
      ? "granice vs tolerowanie"
      : signals.indecision
      ? "działanie vs zwlekanie"
      : "brak jasno nazwanego konfliktu";

  const intensity = scoreIntensity(signals, t);
  const riskLevel = riskLabel(domain, signals, t, intensity);

  const analysis = buildAnalysis(text, domain, conflict, signals, intensity);
  const risk = buildRisk(domain, riskLevel, signals, t);
  const recommendation = buildRecommendation(domain, signals, t, riskLevel);

  return { analysis, risk, recommendation };
}

function buildAnalysis(original, domain, conflict, s, intensity) {
  const vibe =
    s.anger ? "Widzę złość i to jest informacja, nie „problem z Tobą”." :
    s.fear ? "Widzę strach — i uczciwie: często to nie tchórzostwo, tylko sygnał ryzyka." :
    s.overwhelm ? "Widzę przeciążenie. Jak system jest przeciążony, decyzje robią się głupie." :
    "Widzę mieszankę wątków i potrzebuję je uporządkować.";

  const domainLine =
    domain === "relationship" ? "To brzmi jak sprawa relacji i jakości traktowania." :
    domain === "work" ? "To brzmi jak decyzja zawodowa / kierunek rozwoju." :
    domain === "money" ? "Tu w tle mocno siedzi bezpieczeństwo finansowe." :
    "To brzmi jak decyzja życiowa bez jednego oczywistego „twardego” parametru.";

  const conflictLine = `Główny konflikt, który tu słyszę: **${conflict}**.`;

  const intensityLine =
    intensity >= 8 ? "Emocje są wysokie — to normalne, ale to zły moment na decyzje nieodwracalne." :
    intensity >= 5 ? "Emocje są średnie — da się działać, ale potrzebujesz ram i faktów." :
    "Emocje są raczej pod kontrolą — to dobry moment na precyzję.";

  const questions = pickQuestions(domain);

  return [
    `Jestem STAN. ${vibe}`,
    domainLine,
    conflictLine,
    intensityLine,
    "Zanim powiem Ci „co robić”, doprecyzuję, bo wolę być skuteczny niż efektowny:",
    `1) ${questions[0]}`,
    `2) ${questions[1]}`,
    `3) ${questions[2]}`
  ].join("\n");
}

function buildRisk(domain, riskLevel, s, t, intensity) {
  const base =
    riskLevel === "wysokie" ? "Wysokie ryzyko błędnej decyzji." :
    riskLevel === "średnie" ? "Średnie ryzyko — do opanowania, jeśli ustawimy zasady." :
    "Niskie ryzyko — pod warunkiem, że trzymasz się planu.";

  const traps = [];

  if (s.indecision) traps.push("Pułapka: przeciąganie decyzji w nieskończoność (to też jest wybór).");
  if (s.anger && domain === "relationship") traps.push("Pułapka: reakcja odwetowa zamiast granicy i konsekwencji.");
  if (s.fear) traps.push("Pułapka: mylenie strachu z rozsądkiem (albo odwrotnie).");
  if (intensity >= 8) traps.push("Pułapka: decyzja „na emocji” — potem płaci za nią portfel/zdrowie/relacja.");

  const add =
    traps.length ? traps.join("\n") : "Nie widzę tu klasycznej miny — bardziej brak danych do oceny.";

  return `${base}\n${add}`;
}

function buildRecommendation(domain, s, t, riskLevel) {
  // styl: miły + elegancki + czasem cięty
  const edge =
    s.indecision ? "I nie, „jeszcze chwilę pomyślę” nie jest strategią. To jest wymówka w ładnym opakowaniu." :
    s.anger ? "Złość Cię nie kompromituje. Ale jeśli złość prowadzi, to konsekwencje będą Twoje, nie czyjeś." :
    "Dobra decyzja to nie magia — to rama + jeden konkretny krok.";

  const planGeneral = [
    "Zrób to dziś (10–20 min): spisz 2 opcje i ich konsekwencje w 7 dni oraz 30 dni.",
    "Ustal jedną granicę (czas/pieniądze/energia), której nie przekraczasz.",
    "Umów „przegląd decyzji” za 48h — nie po to, by się wahać, tylko by sprawdzić fakty."
  ];

  const planRelationship = [
    "Nazwij 1 zachowanie, które jest nie do przyjęcia (konkret, bez „zawsze/nigdy”).",
    "Powiedz granicę + konsekwencję (spokojnie): „Jeśli X, to ja robię Y”. I potem naprawdę to zrób.",
    "Jeśli boisz się rozmowy: napisz to wcześniej w 3 zdaniach i trzymaj się tekstu."
  ];

  const planWork = [
    "Zabezpiecz bazę: policz minimalny budżet na 3 miesiące (kwota, nie „jakoś będzie”).",
    "Ustal tempo: 3 bloki po 60–90 min tygodniowo nad projektem (konsekwencja > zryw).",
    "Jedna mała walidacja w 7 dni: pokaż projekt 3 osobom i zbierz konkret (co boli / za co zapłacą)."
  ];

  const planMoney = [
    "Wypisz stałe koszty i minimalną poduszkę bezpieczeństwa (liczby, nie intuicja).",
    "Ustal limit ryzyka: ile możesz stracić bez rozwalenia życia (i trzymaj się tego).",
    "Podejmuj decyzje finansowe dopiero po spaniu — serio. Zmęczenie robi z ludzi hazardzistów."
  ];

  const plan =
    domain === "relationship" ? planRelationship :
    domain === "work" ? planWork :
    domain === "money" ? planMoney :
    planGeneral;

  const closer =
    riskLevel === "wysokie"
      ? "Jeśli chcesz, poprowadzę Cię pytaniami, ale bez konkretów nie będę zgadywał. To nie tarot."
      : "Jak odpowiesz na moje 3 pytania z analizy, dopasuję rekomendację na ostro, pod Twoje realia.";

  return [edge, "", ...plan.map((x, i) => `${i + 1) ${x}`), "", closer].join("\n");
}

function pickQuestions(domain) {
  if (domain === "relationship") {
    return [
      "Co dokładnie zrobił/a (1–2 konkretne sytuacje), a nie ogólne „jest okropny/a”?",
      "Czego chcesz: naprawy, zmiany zasad, czy rozstania (choćby jako opcja)?",
      "Jaka jest Twoja granica: co musi się zmienić w 14 dni, żebyś uznała, że to ma sens?"
    ];
  }
  if (domain === "work") {
    return [
      "Jakie masz realne zobowiązania finansowe i na ile miesięcy masz poduszkę?",
      "Co jest Twoim „dowodem postępu” w projekcie za 30 dni (mierzalne)?",
      "Co jest największym ryzykiem: brak kasy, brak czasu, czy brak wiary w siebie?"
    ];
  }
  if (domain === "money") {
    return [
      "Jaka jest konkretna kwota/limit, o który się rozbijamy?",
      "Co jest celem: spokój, wzrost, czy uniknięcie katastrofy (to różne strategie)?",
      "Co możesz zrobić w 48h, żeby zmniejszyć ryzyko o 20%?"
    ];
  }
  return [
    "Jaki jest Twój cel (jedno zdanie, bez ozdobników)?",
    "Co Cię realnie ogranicza (czas/pieniądze/relacje/zdrowie)?",
    "Jaka decyzja Cię straszy i dlaczego — co dokładnie możesz stracić?"
  ];
}

function scoreIntensity(s, t) {
  let score = 3;
  if (s.anger) score += 3;
  if (s.fear) score += 2;
  if (s.overwhelm) score += 2;
  if (hasAny(t, ["!!!", "kurwa", "nienawidzę", "mam dość"])) score += 1;
  return clamp(score, 1, 10);
}

function riskLabel(domain, s, t, intensity) {
  if (domain === "relationship" && hasAny(t, ["przemoc", "bije", "grozi", "szantaż"])) return "wysokie";
  if (intensity >= 8) return "wysokie";
  if (s.fear || s.indecision) return "średnie";
  return "niskie";
}

function normalize(str) {
  return String(str)
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function hasAny(text, arr) {
  return arr.some((x) => text.includes(x));
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}