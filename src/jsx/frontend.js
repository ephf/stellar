window._stellarFunctionRegistry = [];
window.Getr = function Getr({ src, placeholder = "Getting..." }) {
  const el = createElement("span", null, placeholder);
  fetch(src)
    .then((res) => res.text())
    .then((text) => el.replaceWith(createElement("span", null, text)));
  return el;
};

function createElement(name, attributes, ...children) {
  if (typeof name == "function") {
    return name(attributes, ...children);
  }
  const element = name
    ? document.createElement(name)
    : document.createDocumentFragment();
  Object.entries(attributes ?? {}).forEach(([key, value]) => {
    if (typeof value == "function") {
      element.setAttribute(
        key,
        `_stellarFunctionRegistry[${_stellarFunctionRegistry.length}].call(this, event)`
      );
      _stellarFunctionRegistry.push(value);
      return;
    }
    element.setAttribute(key, value);
  });
  element.append(...children);
  return element;
}

export default {
  createElement,
};
