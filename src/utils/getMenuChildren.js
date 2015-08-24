export default function getMenuChildren(request, menuItemId) {
  return request({
    "method": "model.ir.ui.menu.search_read",
    "params": [
      [["parent", "=", menuItemId]],
      0,
      1000,
      null,
      ['name', 'complete_name', 'childs', 'icon', 'action', 'sequence'],
    ],
  })
}
