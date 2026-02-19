export default async function handler(req, res) {

  function reply(analysis, risk, recommendation) {
    return res.status(200).json({
      analysis,
      risk,
      recommendation
    });
  }

  if (req.method !== "POST") {
    return reply(
      "Ten endpoint działa tylko dla POST.",
      "—",
      "Wróć do aplikacji i kliknij „Analiza →”."
    );
  }

  const { text } = req.body || {};
  const input = String(text || "").trim();

  if (input.length < 20) {
    return reply(
      "Danych jest za mało, by podjąć decyzję. Opisz sytuację precyzyjniej: cel, ograniczenia, stawkę.",
      "Ryzyko błędnej oceny: wysokie (brak danych).",
      "Dopisz 2–3 zdania: czego chcesz, czego się boisz, co możesz stracić."
    );
  }

  const lower = input.toLowerCase();

  let analysis = "";
  let risk = "";
  let recommendation = "";

  // 🔎 Wykrywanie napięcia emocjonalnego
  const emotionalWords = ["boję", "strach", "wkurza", "złość", "zmęczona", "nie wiem", "stres"];
  const ambitionWords = ["biznes", "projekt", "zarabiać", "zbudować", "rozwój", "potencjał"];
  const relationshipWords = ["partner", "związek", "relacja", "małżeństwo"];

  const isEmotional = emotionalWords.some(w => lower.includes(w));
  const isAmbition = ambitionWords.some(w => lower.includes(w));
  const isRelationship = relationshipWords.some(w => lower.includes(w));

  // 🧠 Logika STANa

  if (isAmbition) {
    analysis = "Masz ambicję i jednocześnie lęk przed utratą stabilności. To konflikt między wizją a bezpieczeństwem. Problem nie dotyczy odwagi — dotyczy strategii zarządzania ryzykiem.";

    risk = "Ryzyko impulsywnej decyzji: średnie. Ryzyko stagnacji przy braku działania: wysokie.";

    recommendation = "Nie wybieraj 'wszystko albo nic'. Ustal 30-dniowy test: minimalny koszt, maksymalna walidacja. Sprawdź realny popyt zanim zwiększysz skalę.";
  }

  else if (isRelationship) {
    analysis = "Opis wskazuje na narastającą frustrację i brak równowagi w relacji. Emocje są silne, ale decyzja podjęta w ich szczycie może pogłębić konflikt.";

    risk = "Ryzyko eskalacji konfliktu przy reakcji impulsywnej: wysokie.";

    recommendation = "Oddziel emocję od decyzji. Najpierw rozmowa oparta na faktach (co konkretnie boli), dopiero potem decyzja o kierunku relacji.";
  }

  else if (isEmotional) {
    analysis = "Twój stan wskazuje na przeciążenie poznawcze. W takim trybie mózg szuka natychmiastowej ulgi, nie najlepszej decyzji.";

    risk = "Ryzyko decyzji pod wpływem emocji: wysokie.";

    recommendation = "Odłóż decyzję o 24 godziny. Spisz 3 scenariusze: optymistyczny, realistyczny, pesymistyczny. Dopiero potem wybierz ruch.";
  }

  else {
    analysis = "Sytuacja wymaga struktury. Brakuje jasnego podziału na cel, zasoby i ograniczenia. Decyzja bez tej mapy będzie zgadywaniem.";

    risk = "Ryzyko nieoptymalnej decyzji: umiarkowane.";

    recommendation = "Zdefiniuj: 1) Co dokładnie chcesz osiągnąć? 2) Co możesz stracić? 3) Jaki jest najmniejszy możliwy krok testowy?";
  }

  return reply(analysis, risk, recommendation);
}