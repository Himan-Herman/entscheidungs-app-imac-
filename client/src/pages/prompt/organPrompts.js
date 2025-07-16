export function getOrganPrompt(organ) {
    const prompts = {
      herz: " Du hast das Organ **Herz** gewählt. Bitte beschreibe dein Symptom (z.B. Druckgefühl, Schmerzen, Rhythmusprobleme).",
      leber: " Du hast die **Leber** gewählt. Gibt es z.B. Schmerzen im rechten Oberbauch oder Gelbfärbung?",
      lunge: " Du hast die **Lunge** gewählt. Hast du Atemnot, Husten oder Brustschmerzen?",
      magen: " Du hast den **Magen** gewählt. Gibt es Übelkeit, Schmerzen oder Verdauungsprobleme?",
      ruecken: " Du hast den **Rücken** gewählt. Gibt es Verspannungen, Schmerzen oder Bewegungseinschränkungen?",
wirbelsaeule: " Du hast die **Wirbelsäule** gewählt. Sind die Beschwerden lokalisiert oder ausstrahlend?",
niere: " Du hast die **Niere** gewählt. Gibt es Flankenschmerzen, Fieber oder Probleme beim Wasserlassen?",
schulterblatt: " Du hast den Bereich **Schulterblatt** gewählt. Ist die Bewegung eingeschränkt oder schmerzhaft?",
nacken: " Du hast den **Nacken** gewählt. Gibt es Spannung, Schwindel oder Kopfschmerzen?",
becken_links: " Du hast das **linke Becken/Darmbein** gewählt. Gibt es Schmerzen beim Sitzen, Gehen oder Liegen?",
becken_rechts: " Du hast das **rechte Becken/Darmbein** gewählt. Gibt es Beschwerden im Hüftbereich?",

    };
  
    return prompts[organ] || ` Du hast das Organ **${organ}** gewählt. Bitte beschreibe dein Symptom.`;
  }
  