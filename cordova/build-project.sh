cd ..
npm run build
cd cordova/project
cp ../config.xml .
cp -r ../www/* www/
cordova build android --release
cd ..

jarsigner -verbose -sigalg SHA1withRSA -digestalg SHA1 -keystore release.keystore project/platforms/android/build/outputs/apk/android-release-unsigned.apk tryton
zipalign -f -v 4 project/platforms/android/build/outputs/apk/android-release-unsigned.apk Tryton.apk
