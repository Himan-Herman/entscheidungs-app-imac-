export function getOrganPrompt(organ) {
    const prompts = {
      herz: "❤️ Du hast das Organ **Herz** gewählt. Bitte beschreibe dein Symptom (z. B. Druckgefühl, Schmerzen, Rhythmusprobleme).",
      leber: "🧬 Du hast die **Leber** gewählt. Gibt es z. B. Schmerzen im rechten Oberbauch oder Gelbfärbung?",
      lunge: "🫁 Du hast die **Lunge** gewählt. Hast du Atemnot, Husten oder Brustschmerzen?",
      magen: "🌀 Du hast den **Magen** gewählt. Gibt es Übelkeit, Schmerzen oder Verdauungsprobleme?",
    };
  
    return prompts[organ] || `❓ Du hast das Organ **${organ}** gewählt. Bitte beschreibe dein Symptom.`;
  }
  