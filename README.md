# Donjon de poche

Explore un donjon plongé dans le noir. Trouve la clé et la sortie, lis les intentions des monstres et choisis quand dépenser ton huile, tes potions et tes pièces.

**Android 7.0+ avec Android System WebView à jour · 100 % hors ligne dans l’APK · Sans compte · Sans publicité · MIT**

- [Jouer sur la page du jeu](https://zachiran42.github.io/donjon-de-poche/)
- [Télécharger l’APK signé de test](docs/downloads/donjon-de-poche-1.1.0.apk)
- [Signaler un problème](https://github.com/Zachiran42/donjon-de-poche/issues)

## Jouer

1. Tapote les flèches ou une direction autour du héros. Chaque action avance un tour.
2. La torche révèle les environs ; le rouge annonce une frappe au prochain tour.
3. À l’autel, choisis entre soin, lumière et lame. Garde de l’huile pour explorer.

TÉLÉPHONE · Flèches + actions à l’écran · CLAVIER · Flèches / ZQSD · E potion · F huile · ENTRÉE · Attendre · ÉCHAP · Pause

La progression reste stockée localement. Les règles de la version1.1 changent : les anciennes parties en cours redémarrent, les déblocages et améliorations permanentes sont conservés.

## Installer sur Android

Télécharger l’APK depuis ce dépôt ou sa page. Ouvrir le fichier sur Android et autoriser l’installation pour l’application utilisée pour le téléchargement si Android le demande. L’APK 1.1.0 est une version de test signée avec une clé de développement. Une signature de production stable est recommandée avant une distribution durable.

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

## Version 1.1.0

Version enrichie avec commandes et difficulté revues. Le comportement tactile et les performances peuvent varier selon le WebView Android de l’appareil.

## Nouveautés 1.1.0

Visibilité autour du héros avec occlusion des murs et mémoire assombrie du terrain. Les monstres et objets disparaissent hors de la lumière réelle. Torche consommable, huile, potions, ennemis à intentions annoncées et autel offrant un choix payant exclusif entre soin, lumière et amélioration de la lame.

## Publication des mises à jour pour Cercle

Le workflow `.github/workflows/release-apk.yml` publie automatiquement l’APK déjà compilé et signé lors d’un push sur `main`. Il utilise le jeton temporaire GitHub du dépôt ; aucune clé de signature n’est envoyée à GitHub Actions.

1. Augmenter `versionName` et `versionCode` dans `app/build.gradle`.

2. Compiler l’APK avec la même clé de signature que les versions distribuées.

3. Ajouter `docs/downloads/donjon-de-poche-<versionName>.apk` et son fichier `.apk.sha256`.

4. Pousser l’APK, son empreinte et la configuration de version sur `main`.

Le script `tools/publish-apk.py` contrôle la signature, le paquet, la version et le SHA-256 avant de créer une Release contenant l’APK, son empreinte et la licence MIT. Une version publiée est conservée sans remplacement. Un push du code seul ne produit pas un APK de distribution.

Cercle recherche les nouvelles Releases au démarrage, à la demande et lors de sa vérification périodique. Les utilisateurs confirment ensuite le téléchargement et l’installation Android.

Première exécution validée : https://github.com/Zachiran42/donjon-de-poche/actions/runs/41019329632
