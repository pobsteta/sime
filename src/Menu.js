import compose from 'ksf/utils/compose'
import _ContentDelegate from 'absolute/_ContentDelegate'
import MenuBase from './MenuBase'

export default compose(_ContentDelegate, function(args) {
	var message = args.message,
		request = args.request;
	this._content = new MenuBase({
		request: args.request,
		message: args.message,
		defaultButtonSize: args.defaultButtonSize,
		menuItemId: args.menuItemId,
		onItemSelect: function(childMenuItemId) {
			message.value("looking for list view...");
			args.saver.ensureChangesAreSaved().then(function () {
				return request({
					"method": "model.ir.action.keyword.get_keyword",
					"params": [
						"tree_open",
						["ir.ui.menu", childMenuItemId],
					],
				}).then(function(resp) {
					if (resp.length) {
						message.value('');
						var views = resp[0].views;
						var viewId;
						var formViewId;
						for (var i=0; i<views.length; i++) {
							var view = views[i];
							if (view[1] === 'tree') {
								viewId = view[0];
							}
							if (view[1] === 'form') {
								formViewId = view[0];
							}
						}
						var modelId = resp[0]["res_model"];
						args.onDisplayModel(modelId, viewId, formViewId);
					} else {
						message.value('no list view');
					}
					message.value("error");
				}, function(err) {
					console.log("erreur lors de la recherche d'une vue de type liste pour le menu", childMenuItemId, err);
				})
			}, function () {
				// il y a eu une erreur lors de l'enregistrement des données, on ne change pas de page
			})
		}
	})
})
