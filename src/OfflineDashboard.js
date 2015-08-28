import compose from 'ksf/utils/compose'
import _ContentDelegate from 'absolute/_ContentDelegate'
import Switch from 'absolute/Switch'
import VScroll from 'absolute/VScroll'
import VPile from 'absolute/VPile'
import HFlex from 'absolute/HFlex'
import VFlex from 'absolute/VFlex'
import Label from 'absolute/Label'
import Button from 'absolute/Button'
import Space from 'absolute/Space'
import Margin from 'absolute/Margin'
import Background from 'absolute/Background'
import Value from 'ksf/observable/Value'
import Reactive from 'absolute/Reactive'
import ReactiveOrderedBranch from 'absolute/deep/OrderedBranch'
import TransformedValue from 'ksf/observable/TransformedValue'
import MappedValue from 'ksf/observable/MappedValue'
import Leaf from 'ksf/observable/deep/Leaf'

import download from './utils/download'
import upload from './utils/upload'
import {clear as clearDb, readRange as readDb, put as putDb, sublevel, del as delDb} from './utils/db'
import MenuBase from './MenuBase'
import MapBase from './MapBase'
import create from 'lodash/object/create'
import Store from 'ksf/observable/deep/Store'
import KeyOrderedBranch from 'ksf/observable/deep/KeyOrderedBranch'

export default compose(_ContentDelegate, function(args) {
  var requestsDb = sublevel(args.localDb, '_requests')
  var requestsStore = new KeyOrderedBranch(new Store(), '')
  readDb(requestsDb).then(entries =>
    entries.forEach(entry => requestsStore.change(entry.key, entry.value))
  ).then(function () {
    requestsStore.onChange(function (change) {
      if (change.value !== undefined) {
        putDb(requestsDb, change.key, change.value)
      } else {
        delDb(requestsDb, change.key)
      }
    })
  })
  var downloadProgress = new Value('')

  var dashboard = new VScroll(new VPile().content([
    new Label().value("Gestion des données hors-ligne").font({size: '18px', weight: 'bold'}).hAlign('center').height(args.defaultButtonSize),

    new Label().value("Périmètre des données").font({style: 'italic'}).height(50),
    new HFlex([
      [new Label().value("Elément de menu").width(150).color('gray'), 'fixed'],
      new Reactive({
        value: new TransformedValue(args.offlineMenuItemId, function(id) {
          if (id === null) {
            this.value("Aucun")
          } else {
            this.value(id + '');
            args.request({
              "method": "model.ir.ui.menu.read",
              "params": [
                [id],
                ["complete_name"],
              ],
            }).then(resp => {
              this.value(resp[0]['complete_name']);
            }, function() {
              console.log("error retrieving label for", id);
            });
          }
        }),
        content: new Label().value(),
      }),
      [new Button().value("Définir").disabled(!args.online).width(100).onAction(() => {
        this._content.content(new MenuBase(create(args, {
          onItemSelect: (menuItemId) => {
            args.offlineMenuItemId.value(menuItemId)
            // go back
            this._content.content(dashboard)
          },
        })))
      }), 'fixed'],
    ]).height(args.defaultButtonSize),
    new HFlex([
      [new Label().value("Zone géographique").color('gray').width(150), 'fixed'],
      new Reactive({
        value: new MappedValue(args.offlineExtent, extent => extent ? extent.toString() : "Aucune"),
        content: new Label(),
      }),
      [new Button().value("Définir").disabled(!args.online).width(100).onAction(() => {
        var map = new MapBase()
        this._content.content(new VFlex([
          map,
          [new Button().value("OK").onAction(() => {
            args.offlineExtent.value(map.olMap.getView().calculateExtent(map.olMap.getSize()))
            // go back
            this._content.content(dashboard)
          }).height(args.defaultButtonSize)],
        ]));
        // initialize map with saved extent
        var extent = args.offlineExtent.value()
        if (extent) {
          map.olMap.getView().fit(extent, map.olMap.getSize(), { nearest: true })
        }
      }), 'fixed'],
    ]).height(args.defaultButtonSize),

    new Space().height(20),

    new Label().value("Dernier téléchargement").font({style: 'italic'}).height(50),
    new HFlex([
      new Reactive({
        value: args.offlineDataStatus,
        content: new Label(),
      }),
      [new Button().value("Télécharger maintenant").disabled(!args.online).onAction(()=> {
        downloadProgress.value("Téléchargement des données en cours...")
        args.offlineDataStatus.value("Aucune données")
        var db = args.localDb
        clearDb(db).then(() => {
          download(args.request, args.wfsRequest, db,
            args.offlineMenuItemId.value(),  // menuID
            args.offlineExtent.value()  // extent in EPSG:3857 (Mercator)
          ).then(
            () => {
              args.offlineDataStatus.value(new Date().toISOString())
              downloadProgress.value("Téléchargement terminé")
            },
            (err) => {
              args.offlineDataStatus.value("["+new Date().toISOString()+"] Erreur : "+JSON.stringify(err))
              downloadProgress.value("Erreur lors du téléchargement")
            }
          )
        })
      }).width(200), 'fixed'],
    ]).height(args.defaultButtonSize),

    [new Reactive({
      value: downloadProgress,
      content: new Label(),
    }).height(args.defaultButtonSize), 'fixed'],

    new Space().height(20),

    new Label().value("Modifications en attente").font({style: 'italic'}).height(50),
    new HFlex([
      new Reactive({
        value: new MappedValue(requestsStore, function () {
          return requestsStore.keys().length + ' requêtes'
        }),
        content: new Label(),
      }),
      [new Button().value("Envoyer maintenant").disabled(!args.online).onAction(function () {
        args.message.value("Envoi en cours...")
        upload(requestsStore, args.request, args.wfsRequest).then(
          ()=>args.message.value("Envoi terminé"),
          ()=>args.message.value("Echec lors de l'envoi")
        )
      }).width(200), 'fixed'],
    ]).height(args.defaultButtonSize),
    new HFlex([
      new Space(),
      [new Button().value("Voir les requêtes en attente").onAction(() => {
        this._content.content(new VFlex([
          [new Button().value('retour').onAction(
            () => this._content.content(dashboard)
          ).height(args.defaultButtonSize), 'fixed'],
          [new Space().height(20), 'fixed'],
          [new Reactive({
            value: new MappedValue(requestsStore, function () {
              return requestsStore.keys().length + ' requêtes'
            }),
            content: new Label(),
          }).height(50), 'fixed'],
          [new HFlex([
            new Label().value("Requête"),
            new Label().value("Message"),
            new Label().value("Action"),
          ]).height(args.defaultButtonSize), 'fixed'],
          new VScroll(new ReactiveOrderedBranch({
            value: requestsStore,
            content: new VPile(),
            onKeyAdded: (pile, key) => {
              var req = requestsStore.value()[key+'/request']
              pile.add(key, new Margin(new Background(new HFlex([
                new VFlex([
                  new Label().value(JSON.stringify(req.type)),
                  new Label().value(JSON.stringify(req.request.method)),
                  new Label().value(JSON.stringify(req.request.params)),
                ]),
                new Reactive({
                  value: new MappedValue(new Leaf(requestsStore, key+'/lastTry'), val =>
                    val ? val.time + ' : '+JSON.stringify(val.response) : "en attente"
                  ),
                  content: new Label(),
                }),
                new Margin(new Button().value("Supprimer").onAction(() => {
                  requestsStore.removeKey(key)
                }), 5),
              ])).color('transparent').border('1px solid lightgrey'), 5).height(100))
            },
            onKeyRemoved: (pile, key) => {
              pile.remove(key)
            },
          })),
          [new Button().value("Envoyer maintenant").disabled(!args.online).onAction(function () {
            args.message.value("Envoi en cours...")
            upload(requestsStore, args.request, args.wfsRequest).then(
              ()=>args.message.value("Envoi terminé"),
              ()=>args.message.value("Echec lors de l'envoi")
            )
          }).height(args.defaultButtonSize), 'fixed'],

        ]))
      }).width(200), 'fixed'],
    ]).height(args.defaultButtonSize),
  ]))
  this._content = new Switch().content(dashboard)
})
