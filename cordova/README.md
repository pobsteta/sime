Compilation rapide
==================

  ./create-project.sh
  ./build-project.sh

Explications détaillées
=======================
Créer le projet:

    # à partir de /cordova :
    cordova create project fr.bef.tryton "Tryton Mobile" --copy-from=../www

Copier le fichier config.xml (à faire avant d'ajouter une plateforme) :

    cp config.xml project/config.xml

et les icônes :

    cp -r icons project/

Puis configurer le projet :

    cd project/

    cordova plugin add cordova-plugin-whitelist
    cordova platform add android

Déploiement
===========

# Générer l'APK
Compiler le javascript:

	npm run build

Puis compiler le projet Cordova (à partir de /cordova/project) :

    cordova build android --release

# Signer l'APK
http://developer.android.com/tools/publishing/app-signing.html

	jarsigner -verbose -sigalg SHA1withRSA -digestalg SHA1 -keystore release.keystore project/platforms/android/build/outputs/apk/android-release-unsigned.apk tryton

zipalign se trouve dans : android-sdk/build-tools/{version}/

    zipalign -f -v 4 project/platforms/android/build/outputs/apk/android-release-unsigned.apk Tryton.apk

Divers
======

# Pour tester l'appli dans l'émulateur
	cordova emulate android

# Pour tester l'appli sur un appareil branché en USB
	cordova run android --device

# Clé de signature
La clé pour signer le APK est dans cordova/release.keystore (mot de passe : "tryton")

Pour info, pour générer une clé (à faire une seule fois) :

    keytool -genkey -v -keystore release.keystore -alias tryton -keyalg RSA -keysize 2048 -validity 10000
