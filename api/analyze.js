export default function handler(req, res) {
  // DEMO (bez API) — STAN: elegancki, precyzyjny, z humorem i pazurem
  // Zwraca zawsze JSON: { analysis, risk, recommendation }

  const reply = (analysis, risk, recommendation, status = 200) =>
    res.status(status).json({ analysis, risk, recommendation });

  if (req.method !== "POST") {
    return reply(
      "Ten endpoint działa tylko dla POST.",
      "—",
      'Wróć do aplikacji i kliknij „Analiza →”.'
    );
  }

  const { text } = req.body || {};
  const userText = String(text || "").trim();

  if (userText.length < 40) {
    return reply(
      "Za mało danych. Nie będę wróżyć z fusów — opisz to trochę szerzej.",
      "Ryzyko błędnej interpretacji: wysokie.",
      "Dopisz 2–3 zdania: co się stało, czego chcesz, jakie masz ograniczenia."
    );
  }

  // ---------- 1) Sygnały emocji/chaosu/unikania ----------
  const hasStrongEmotion = /wkur|nienaw|zajeb|pierdol|kurw|chuj|boję|panik|złość|frustr|płacz|rozpad/i.test(userText);
  const hasAvoidance = /nie wiem|jakoś|kiedyś|może|chyba|zobacz|zobaczymy|nie teraz|później/i.test(userText);
  const hasDeadline = /dziś|jutro|w tym tyg|w 7 dni|w 30 dni|do \d{1,2}\.|deadline|termin/i.test(userText);
  const mentionsMoney = /pienią|kasa|dług|kredyt|czynsz|zobowią|budżet|dochód|praca|zarab/i.test(userText);
  const mentionsRelationship = /partner|związek|on|ona|relacja|małżeń|rozst|zdrad|kłót|granice/i.test(userText);
  const mentionsHealth = /zdrow|lekarz|objaw|ból|diagnoz|ciąża|krwaw|depres|lęk/i.test(userText);

  // ---------- 2) Temat ----------
  const topic = mentionsRelationship
    ? "relacje"
    : mentionsMoney
    ? "finanse/praca"
    : mentionsHealth
    ? "zdrowie"
    : "ogólne";

  // ---------- 3) Braki danych (STAN ma być uczciwy) ----------
  const hasGoal = /chcę|cel|zależy mi|moim celem|potrzebuję|chciałabym|chciałbym/i.test(userText);
  const hasConstraints = /nie mogę|ogranicze|budżet|czas|dzieci|zobowią|zdrow/i.test(userText);
  const hasOptions = /opcja|wariant|albo|czy|zostać|odejść|zmienić|rzucić|przenieść/i.test(userText);

  const missing = [];
  if (!hasGoal) missing.push("cel");
  if (!hasConstraints) missing.push("ograniczenia");
  if (!hasOptions) missing.push("opcje");

  // ---------- 4) Ton STANa (auto-dopasowanie) ----------
  // Elegancki zawsze, ale „pazur” gdy: chaos + unikanie + emocje
  const shouldBeSharp = hasAvoidance && hasStrongEmotion;
  const shouldBeGentle = !shouldBeSharp && (hasStrongEmotion || topic === "zdrowie");

  const voice = {
    softOpen: [
      "OK. Słyszę w tym napięcie — i nie będę Cię za to oceniać.",
      "Dobra. Zatrzymajmy chaos na chwilę i złapmy fakty.",
      "Widzę, że to Ci siedzi mocno. Spokojnie: rozplączemy to."
    ],
    sharpOpen: [
      "Stop. Teraz mieszasz emocje z decyzją — to proszenie się o błąd.",
      "Dobra, słuchaj: bez konkretów będziemy kręcić kółka jak pralka bez odpływu.",
      "Widzę unikanie. Jeśli chcesz zmiany — musimy zejść z mgły na ziemię."
    ],
    elegantOpen: [
      "Weźmy to na chłodno i po kolei.",
      "Ułóżmy sytuację w logiczny ciąg, zanim wybierzesz ruch.",
      "Zrobię z tego mapę decyzji, nie dramat."
    ],
    humorTag: [
      "I tak: to jest moment, w którym mózg lubi robić teatr. Ja wolę plan.",
      "Nie będę wróżyć. Będę mierzyć.",
      "Spokojnie — decyzje są jak puzzle: da się je ułożyć, tylko nie na siłę."
    ],
    sharpTag: [
      "Jeśli zostawisz to „na później”, to „później” wybierze za Ciebie.",
      "Brak decyzji też jest decyzją. Tylko zwykle najgorszą.",
      "Nie myl strachu z rozsądkiem — i nie myl rozsądku z wymówką."
    ]
  };

  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  let opener;
  if (shouldBeSharp) opener = pick(voice.sharpOpen);
  else if (shouldBeGentle) opener = pick(voice.softOpen);
  else opener = pick(voice.elegantOpen);

  const tag = shouldBeSharp ? pick(voice.sharpTag) : pick(voice.humorTag);

  // ---------- 5) Risk scoring ----------
  let riskScore = 0;
  if (hasStrongEmotion) riskScore += 2;
  if (hasAvoidance) riskScore += 2;
  if (missing.length >= 2) riskScore += 2;
  if (hasDeadline) riskScore += 1;

  const riskLabel =
    riskScore >= 6 ? "wysokie" : riskScore >= 3 ? "średnie" : "niskie";

  // ---------- 6) Składamy odpowiedź ----------
  const missingLine =
    missing.length > 0
      ? `Brakuje mi danych (${missing.join(", ")}). Nie kończę na skróty — dopytam.`
      : "Masz wystarczająco danych, żeby zrobić sensowny ruch bez zgadywania.";

  const topicLine =
    topic === "relacje"
      ? "To wygląda na temat relacyjny: granice, komunikacja i realne zachowania (nie deklaracje)."
      : topic === "finanse/praca"
      ? "To wygląda na temat pracy/finansów: bezpieczeństwo vs ryzyko i tempo przejścia."
      : topic === "zdrowie"
      ? "To wygląda na temat zdrowotny: tu precyzja i bezpieczeństwo są ważniejsze niż szybkość."
      : "To wygląda na temat decyzyjny ogólny: priorytety, konsekwencje, plan.";

  const analysis = [
    opener,
    topicLine,
    missingLine,
    tag
  ].join(" ");

  // RISK — krótko, konkretnie
  const riskParts = [];
  if (hasStrongEmotion) riskParts.push("emocje wysokie");
  if (hasAvoidance) riskParts.push("unikanie/nieokreśloność");
  if (missing.length >= 2) riskParts.push("braki danych");
  if (hasDeadline) riskParts.push("presja czasu");

  const risk = `Ryzyko decyzji impulsywnej / błędnej interpretacji: ${riskLabel}${
    riskParts.length ? ` (${riskParts.join(", ")})` : ""
  }.`;

  // REKOMENDACJA — 7 dni / 30 dni + pytania jeśli braki
  const questions = [];
  if (!hasGoal) questions.push("Jaki jest Twój cel w 1 zdaniu?");
  if (!hasConstraints) questions.push("Jakie są twarde ograniczenia (czas/pieniądze/zdrowie)?");
  if (!hasOptions) questions.push("Jakie są 2 realne opcje do wyboru (A/B)?");

  let recommendation = "";
  if (questions.length) {
    recommendation = [
      "Zanim pójdziemy dalej, odpowiedz mi krótko na te pytania:",
      ...questions.map((q, i) => `${i + 1}) ${q}`),
      "Potem zrobię Ci plan na 7 dni i 30 dni — bez lania wody."
    ].join(" ");
  } else {
    // plan bazowy zależnie od tematu
    const plan7 =
      topic === "relacje"
        ? "W 7 dni: spisz 3 konkretne sytuacje (fakty + co wtedy zrobiłaś + co zrobił on/ona). Ustal 1 granicę i 1 konsekwencję, którą realnie dowieziesz."
        : topic === "finanse/praca"
        ? "W 7 dni: policz minimalny budżet na 3 miesiące i zrób listę 3 źródeł dochodu/klientów/etapów. Zrób 1 mały test projektu (nie rewolucję)."
        : topic === "zdrowie"
        ? "W 7 dni: zbierz objawy/fakty (kiedy, jak często, co nasila) i umów konsultację, jeśli jest ryzyko. Nie diagnozuj się emocjami."
        : "W 7 dni: wybierz 2 opcje (A/B), wypisz plusy/minusy i konsekwencje w 7 oraz 30 dni. Zrób jeden mały krok testowy.";

    const plan30 =
      topic === "relacje"
        ? "W 30 dni: jedna rozmowa na faktach + obserwacja zachowania. Jeśli brak poprawy: decyzja (warunki kontynuacji albo wyjście)."
        : topic === "finanse/praca"
        ? "W 30 dni: harmonogram przejścia (np. 80/20 → 60/40 → 40/60). Ustal próg: kiedy wchodzisz głębiej, a kiedy stop."
        : topic === "zdrowie"
        ? "W 30 dni: wdrożenie zaleceń + monitoring. Jeśli brak poprawy — druga opinia/diagnostyka."
        : "W 30 dni: ustaw mierniki (postęp, koszt, stres), przetestuj opcję A i zdecyduj, czy skalujesz, czy zmieniasz kierunek.";

    recommendation = `${plan7} ${plan30} Jeśli chcesz, podaj mi 2 opcje A/B, to dopnę to bardziej precyzyjnie.`;
  }

  return reply(analysis, risk, recommendation);
}