# Horlogia - Manhwa

Temps du monde pour la suite Manhwa (Foundry VTT v13). Remplace Calendaria et Hourglass.

## 1.2.1
- Bannières de saison plus visibles ; date du thème parchemin en Cinzel (chiffres lisibles).
- Cases à cocher alignées dans la fenêtre d'événement ; la barre de sélection de jours ne déborde plus.

## 1.2.0
- **Barre du haut sur une ligne** : jour de la semaine bien visible devant la date (3 thèmes).
- **Bannière de saison** sur la barre : printemps (fleurs), été (soleil), automne (feuilles), hiver (neige), adaptée au thème.
- **Clic sur la date, l'heure ou la météo** (MJ) : petite bulle pour changer jour / mois / année, heure / minutes, degrés et météo.
- **42 météos reprises de Calendaria** (standard, sévère, environnement, fantasy), avec leurs plages de degrés ; tirage selon la saison.
- **Chrono de combat en compte à rebours** : durée au choix (1 à 30 min, libre ou sans limite), ajouts +5 s / +10 s / +15 s / +30 s / +1 min, son et alerte à zéro.
- **Groupes** : on y ajoute des joueurs, tous leurs personnages suivent.
- **Calendrier** : sélection de plusieurs jours (clic puis Maj + clic, ou glisser), « Créer un événement sur X jours », nom et couleur en premier ; les événements sur plusieurs jours forment une bande continue et colorent les jours.
- Correctif : la fenêtre ne remonte plus en haut quand on clique un bouton.

## 1.1.1
- Thèmes : les boutons Lecture / Combat de la fenêtre ne prennent plus le style des onglets ; chiffres lisibles sur parchemin (Cinzel) pour l'heure, le chrono et les jours ; lune visible sur parchemin ; police des cases à cocher.

## 1.1.0
- **Thèmes par groupe** (carte du groupe, onglet Groupes) : Spatial, **Fantasy — parchemin et encre** (vieux papier, encre sépia, calligraphie, fêtes en cachets de cire, chrono-sablier), **Steampunk — machine à écrire** (laiton, cuir, rivets, engrenages, heure en tambours de compteur, jours en touches de machine à écrire, chrono à cadran et aiguille). Le thème s'applique à la barre, au calendrier, au chrono de combat et aux fenêtres du groupe.

## 1.0.1
- Import Calendaria : bon jour de la semaine (repris du premier jour de l'année de Calendaria), dates des notes corrigées (mois et jour comptés à partir de 1), durée des notes sur plusieurs jours, notes qui doublonnent une fête ignorées, notes annuelles et notes MJ reprises.
- Le chrono de combat passe au-dessus des fenêtres.

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
