cd ..
npm run release-cordova
cd cordova/project
cp ../config.xml .
cp -r ../www/* www/
cordova build android --release
cd ..

jarsigner -verbose -sigalg SHA1withRSA -digestalg SHA1 -keystore release.keystore project/platforms/android/build/outputs/apk/android-armv7-release-unsigned.apk tryton
jarsigner -verbose -sigalg SHA1withRSA -digestalg SHA1 -keystore release.keystore project/platforms/android/build/outputs/apk/android-x86-release-unsigned.apk tryton
zipalign -f -v 4 project/platforms/android/build/outputs/apk/android-armv7-release-unsigned.apk SIME-arm7.apk
zipalign -f -v 4 project/platforms/android/build/outputs/apk/android-x86-release-unsigned.apk SIME-x86.apk
