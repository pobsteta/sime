cordova create project fr.bef.tryton "Tryton Mobile" --copy-from=www
cp config.xml project/config.xml
cp -r icons project/
cd project/
cordova plugin add cordova-plugin-whitelist
cordova plugin add https://github.com/ffournier/cordova-plugin-mbtiles.git
cordova plugin add cordova-plugin-crosswalk-webview
cordova platform add android

cd ..
