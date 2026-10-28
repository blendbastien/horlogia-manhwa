# Horlogia - Manhwa

Temps du monde pour la suite Manhwa (Foundry VTT v13). Remplace Calendaria et Hourglass.

## 1.0.0
- **Barre du haut** (joueurs et MJ) : date, jour, ère, heure qui défile, saison, météo et degrés, phase de lune, fêtes du jour. Elle suit le Play / Pause du MJ (et la pause de Foundry, réglable). Déplaçable (poignée, double-clic pour la remettre).
- **Commandes du MJ** : Lecture / Pause, avancer (+1 min, +10 min, +1 h, +6 h, matin suivant, +1 jour, +1 semaine, temps libre ; un groupe ou tous), mode combat, fenêtre Horlogia.
- **Groupes** : chaque groupe a sa date, son calendrier, sa météo et ses membres (groupe du Menu lié et/ou personnages). Les joueurs voient la date de leur groupe. Groupe de référence pour la saison de la suite.
- **Calendriers entièrement modifiables** : nom, nom de l'année / ère, mois (noms, jours), jours de la semaine, heures, minutes, secondes, années bissextiles, saisons (début, type, couleur, icône), lunes (cycle, décalage, couleur).
- **Calendrier** (vue mois / année) : fêtes et événements sur un ou plusieurs jours (glisser sur les jours), couleur, icône, description, chaque année ou une année précise, pour tous ou certains groupes, cachés aux joueurs.
- **Météo** : choisie ou tirée selon la saison (option : chaque nouveau jour).
- **Mode combat** : grand chrono détaché qui compte le temps du combat (suit Play / Pause), +6 s, +1 tour, +1 min, temps libre ; à la fin, la durée s'ajoute à l'heure du groupe.
- **Autres modules** : chaque nouveau jour envoie `horlogiaNewDay` ; seuls les groupes cochés « font avancer les modules » envoient aussi `manhwaNewDay` (Signal Quotidien…). Désactivé par défaut.
- **Import depuis Calendaria** : calendrier, date et heure, saisons, lunes, fêtes, météo.
- API : `HORLOGIA.now()`, `advance()`, `setDate()`, `setPlay()`, `season()`, `eventsToday()`, `combat`.
