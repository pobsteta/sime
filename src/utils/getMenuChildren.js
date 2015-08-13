export default function getMenuChildren(request, menuItemId) {
  return request({
    "method": "model.ir.ui.menu.search",
    "params": [
      [["parent", "=", menuItemId]],
      0,
      1000,
      null,
    ],
  })
}
