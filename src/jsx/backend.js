export class Element {
  constructor(name, attributes, children) {
    this.name = name;
    this.attributes = attributes;
    this.children = children;
  }
  toString() {
    return (
      `jsx.createElement(${
        typeof this.name == "string" ? JSON.stringify(this.name) : this.name
      }, ${
        this.attributes
          ? "{ " +
            Object.entries(this.attributes)
              .map(
                ([key, value]) =>
                  `"${key}": ${
                    typeof value == "string"
                      ? JSON.stringify(value)
                      : value.toString()
                  }`
              )
              .join(", ") +
            " }"
          : "null"
      }` +
      (this.children.length > 0
        ? ", " +
          this.children
            .map((child) =>
              child instanceof Element ? child : JSON.stringify(child)
            )
            .join(", ")
        : "") +
      ")"
    );
  }
  toHTML() {
    return `<${this.name}${
      this.attributes
        ? " " +
          Object.entries(this.attributes)
            .map(([key, value]) => `${key}="${value}"`)
            .join("")
        : ""
    }>${this.children
      .map((child) => (typeof child == "string" ? child : child.toHTML()))
      .join("")}</${this.name}>`;
  }
}

export default {
  createElement(name, attributes, ...children) {
    return new Element(name, attributes, children);
  },
};
