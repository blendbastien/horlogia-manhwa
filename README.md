# Horlogia — `horlogia-manhwa`

Gestion du temps : calendriers modifiables, une date par Groupe MJ, Lecture/Pause, barre du haut, mode combat, compteurs, météo. API `globalThis.HORLOGIA`.

La documentation détaillée du module est dans `DOCUMENTATION.md`.

Code de la version **1.13.1** (dernière release), pour Foundry VTT v13.

## Liens avec la suite Manhwa

La suite compte un système (Fiche - Manhwa) et 11 modules. La Fiche est le centre : les données partagées y vivent et les modules les lisent via `globalThis.MANHWA`.

- Groupes = Groupes MJ de la Fiche ; suit les saisons de la Fiche.
- Émet `horlogiaChange`, `horlogiaNewDay`, `horlogiaView` et `manhwaNewDay` (Signal Quotidien et réassort de la Boutique).
- `HORLOGIA` est lu par l'Interface (Chroniques) et la Fiche (fêtes, saison).
- Règle commune : un module ne plante jamais si un autre est absent (vérifier `game.modules.get(id)?.active` avant d'appeler son API).

## Livraison

1. Augmenter `version` dans `module.json` (jamais deux livraisons au même numéro).
2. Construire le zip, qui doit contenir le dossier `horlogia-manhwa/` :
   ```bash
   mkdir -p build/horlogia-manhwa && git archive HEAD | tar -x -C build/horlogia-manhwa
   cd build && zip -qr horlogia-manhwa.zip horlogia-manhwa
   ```
3. Créer la release GitHub `vX.Y.Z` avec **exactement 2 fichiers** : `module.json` et `horlogia-manhwa.zip`. Le manifeste pointe vers `releases/latest/download/…`.
4. The Forge : Bazaar → *Install From Manifest* avec l'URL versionnée `https://github.com/blendbastien/horlogia-manhwa/releases/download/vX.Y.Z/module.json`. Ne jamais utiliser *Update All Packages*.
5. Redémarrer le monde de test, vérifier la version installée et tester.
