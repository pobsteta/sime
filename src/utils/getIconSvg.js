import trytonIcons from '../icons/tryton/index'

export default function requestIconSvg(request, iconName) {
	if (iconName in trytonIcons) {
		return Promise.resolve(trytonIcons[iconName])
	} else {
		return request({ method: 'model.ir.ui.icon.search_read', params: [
			[['name', "=", iconName]],
			0,
			1,
			null,
			['icon'],
		]}).then(res => res[0] ? res[0].icon : '')
	}
}
