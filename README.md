# Donjon de poche

Explore un donjon au tour par tour. Chaque pas fait avancer les monstres : récupère les trésors, ménage tes potions et rejoins l’escalier.

**Android 7.0+ avec Android System WebView à jour · 100 % hors ligne dans l’APK · Sans compte · Sans publicité · MIT**

- [Jouer sur la page du jeu](https://zachiran42.github.io/donjon-de-poche/)
- [Télécharger l’APK signé de test](docs/downloads/donjon-de-poche-1.0.0.apk)
- [Signaler un problème](https://github.com/Zachiran42/donjon-de-poche/issues)

## Jouer

1. Touche une case voisine pour te déplacer ou attaquer.
2. Après ton action, les monstres jouent leur tour.
3. Récupère les ressources et atteins les étages suivants.

Sur ordinateur : flèches, WASD ou ZQSD. Échap met le jeu en pause. Une partie en cours et la progression sont conservées localement. Les données de la démo web et celles de l’APK sont indépendantes.

## Installer sur Android

Télécharger l’APK depuis ce dépôt ou sa page. Ouvrir le fichier sur Android et autoriser l’installation pour l’application utilisée pour le téléchargement si Android le demande. L’APK 1.0.0 est une version de test signée avec une clé de développement. Une signature de production stable est recommandée avant une distribution durable.

## Développer et compiler

Jeu écrit en JavaScript Canvas, embarqué dans une petite activité Android Java. Aucun framework, aucune dépendance de jeu distante et aucun serveur. Le dossier docs/ est à la fois la page GitHub Pages et le contenu local embarqué dans l’APK.

Prérequis : JDK 17, Android SDK 35 et Build Tools 35.0.0. Ouvrir dans Android Studio ou configurer ANDROID_HOME, puis :

~~~sh
chmod +x gradlew && ./gradlew assembleDebug
# Windows : .\gradlew.bat assembleDebug
~~~

APK : app/build/outputs/apk/debug/app-debug.apk. Le wrapper télécharge Gradle 8.11.1 au premier lancement. La compilation nécessite Internet pour les outils ; le jeu installé fonctionne en mode avion.

~~~sh
node --test tests/*.test.cjs
# Prévisualisation : servir docs/ avec un serveur HTTP statique.
~~~

## GitHub Pages

La page est dans docs/. Dans Settings → Pages, choisir « Deploy from a branch », branche main, dossier /docs. Le workflow Android valide le code et produit un APK de test en artefact à chaque push.

## Confidentialité et licence

Aucune permission INTERNET dans le manifeste Android. Pas de télémétrie ni d’achats. Sauvegardes Android automatiques désactivées. Les visites de la démo web restent soumises au fonctionnement de GitHub Pages. Voir [la politique détaillée](docs/privacy.html).

Le code, les graphismes procéduraux et les textes originaux sont sous [licence MIT](LICENSE). Le wrapper Gradle et les outils de compilation tiers conservent leurs propres licences.

## Version 1.0.0

Première version jouable. Le comportement tactile et les performances peuvent varier selon le WebView Android de l’appareil.
