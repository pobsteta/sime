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

import IconButton from './IconButton'
import * as icons from './icons/index'


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
  var syncProgress = new Value('')

  var dashboard = new VScroll(new VPile().content([
    new Label().value("Paramètres de l'application").font({size: '18px', weight: 'bold'}).hAlign('center').height(args.defaultButtonSize),

    new HFlex([
      new Label().value("Version de l'application").color('gray'),
      new Label().value('0.4'),
    ]).height(args.defaultButtonSize),

    new Label().value("Données hors ligne").font({style: 'italic'}).height(50),
    new HFlex([
      new Label().value("Elément de menu").color('gray'),
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
      [new IconButton().icon(icons.editFind).disabled(!args.online).onAction(() => {
        this._content.content(new MenuBase(create(args, {
          onItemSelect: (menuItemId) => {
            args.offlineMenuItemId.value(menuItemId)
            // go back
            this._content.content(dashboard)
          },
        })))
      }).width(args.defaultButtonSize), 'fixed'],
    ]).height(args.defaultButtonSize),
    new HFlex([
      new Label().value("Zone géographique").color('gray'),
      new Reactive({
        value: new MappedValue(args.mapExtent, extent => extent ? extent.toString() : "Aucune"),
        content: new Label(),
      }),
      [new IconButton().icon(icons.editFind).disabled(!args.online).onAction(() => {
        var map = new MapBase({
          extent: args.mapExtent.value(),
        })
        this._content.content(new VFlex([
          map,
          [new Button().value("OK").onAction(() => {
            args.mapExtent.value(map.olMap.getView().calculateExtent(map.olMap.getSize()))
            // go back
            this._content.content(dashboard)
          }).height(args.defaultButtonSize)],
        ]));
      }).width(args.defaultButtonSize), 'fixed'],
    ]).height(args.defaultButtonSize),

    new HFlex([
      new Label().value("Dernier téléchargement").color('gray'),
      new Reactive({
        value: new MappedValue(args.offlineDataStatus, (status) => {
          var d = new Date(status)
          if (isNaN(d.getTime())) {
            return status // ce n'est pas une date
          } else {
            return d.toLocaleString()
          }
        }),
        content: new Label(),
      }),
      [new Space().width(args.defaultButtonSize), 'fixed'],
    ]).height(args.defaultButtonSize),

    new HFlex([
      new Label().value("Modifications en attente").color('gray'),
      new Reactive({
        value: new MappedValue(requestsStore, function () {
          return requestsStore.keys().length + ' requête(s)'
        }),
        content: new Label(),
      }),
      [new IconButton().icon(icons.faceGlasses).onAction(() => {
        this._content.content(new VFlex([
          [new IconButton().icon(icons.previous).onAction(
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
          // [new IconButton().icon(icons.mailSendReceive).disabled(!args.online).onAction(function () {
          //   args.message.value("Envoi en cours...")
          //   upload(requestsStore, args.request, args.wfsRequest).then(
          //     ()=>args.message.value("Envoi terminé"),
          //     ()=>args.message.value("Echec lors de l'envoi")
          //   )
          // }).height(args.defaultButtonSize), 'fixed'],

        ]))
      }).width(args.defaultButtonSize), 'fixed'],
    ]).height(args.defaultButtonSize),

    new Space().height(20),

    new IconButton().icon(icons.mailSendReceive).title("Synchroniser les données").disabled(!args.online).onAction(function () {
      // upload
      syncProgress.value("Upload en cours...")
      upload(requestsStore, args.request, args.wfsRequest)
      // download (si l'upload a été successful)
      .then(() => {
        syncProgress.value("Téléchargement des données en cours...")
        args.offlineDataStatus.value("Aucunes données")
        var db = args.localDb
        return clearDb(db).then(() => {
          return download(args.request, args.wfsRequest, db,
            args.offlineMenuItemId.value(),  // menuID
            args.mapExtent.value()  // extent in EPSG:3857 (Mercator)
          ).then(
            () => {
              args.offlineDataStatus.value(new Date().toISOString())
            },
            (err) => {
              args.offlineDataStatus.value("["+new Date().toISOString()+"] Erreur : "+JSON.stringify(err))
              throw(err)
            }
          )
        })
      })
      .then(
        ()=>syncProgress.value("Synchronisation terminée"),
        (err)=> {
          syncProgress.value("Echec de la synchronisation : "+JSON.stringify(err))
          console.log('Erreur lors de la synchro', err)
        }
      )
    }).height(args.defaultButtonSize),
    new Reactive({
      value: syncProgress,
      content: new Label().hAlign('center'),
    }).height(args.defaultButtonSize),

  ]))
  this._content = new Switch().content(dashboard)
})
