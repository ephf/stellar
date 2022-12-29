const WHITESPACE = /[ \r\n\t]/;
const EXPRESSION = /(^|[^\w)\]]|return)$/;

export default function parse(jsx) {
  const stack = [{ type: null }];
  return (
    'import jsx from "stellar/src/jsx/backend.js"\n' +
    [...jsx].reduce((js, char, i) => {
      const top = stack.at(-1);

      if (top.type == "comment") {
        if (char == "\r" || char == "\n") {
          stack.pop();
          return js + char;
        }

        return js;
      }

      if (top.type == "string") {
        if (char == "\n") {
          return js + "\\n";
        }
        if (char == "\r") {
          return js + "\\r";
        }

        if (top.lesc) {
          top.lesc = false;
        }

        if (top.esc) {
          top.esc = false;
          top.lesc = true;
          return js + char;
        }

        if (char == "\\") {
          top.esc = true;
          return js + char;
        }

        if (top.char == char) {
          stack.pop();
          return js + char;
        }

        if (char == "{" && jsx[i - 1] == "$" && !top.lesc && top.char == "`") {
          stack.push({ type: null });
          return js + char;
        }

        return js + char;
      }

      if (top.type == "html") {
        if (char == "\n" || char == "\r") {
          top.newline = true;
        }

        if (char == "<") {
          top.newline = false;

          if (top.text) {
            js += `, ${JSON.stringify(top.text)}`;
            top.text = "";
          }

          stack.push({
            type: "tag",
            name: "",
            named: false,
            closing: null,
            attrName: "",
            attrVal: false,
            fattr: true,
          });
          return js + ", ";
        }

        if (char == "{") {
          top.newline = false;

          if (top.text) {
            js += `, ${JSON.stringify(top.text)}`;
            top.text = "";
          }

          stack.push({ type: null, close: "" });
          return js + ", ";
        }

        if (top.text || !top.newline) {
          if (char == "\n" || char == "\r") {
            if (top.text) {
              js += `, ${JSON.stringify(top.text)}`;
              top.text = "";
              return js;
            }
          }

          top.text += char;
          return js;
        }

        if (!char.match(WHITESPACE)) {
          top.newline = false;
          top.text = char;
          return js;
        }

        return js;
      }

      if (top.type == "tag") {
        if (top.closing === null) {
          if (char == "/") {
            top.closing = true;
            return js;
          }
          top.closing = false;
        }

        if (!top.named) {
          if (char.match(/\w/)) {
            top.name += char;
            return js;
          }
          top.named = true;
          if (top.closing) {
            js = js.replace(/, $|$/, ")");
          } else {
            if (top.name == "head") {
              js += `export const head = jsx.createElement("head", {`;
            } else {
              js += `jsx.createElement(${
                top.name.match(/^[A-Z]/) ? top.name : `"${top.name}"`
              }, { `;
            }
          }
        }

        if (top.attrVal) {
          if (char == "{") {
            stack.push({ type: null, close: "" });
            top.attrVal = false;
            return js;
          }

          if (char == '"') {
            stack.push({ type: "string", char, esc: false, lesc: false });
            top.attrVal = false;
            return js + char;
          }
        }

        attrNameLogic: if (top.attrName) {
          if (char.match(WHITESPACE) || char == ">" || char == "/") {
            if (top.fattr) {
              top.fattr = false;
            } else {
              js += ", ";
            }
            js += `"${top.attrName}": true`;
            top.attrName = "";
            break attrNameLogic;
          }

          if (char == "=") {
            if (top.fattr) {
              top.fattr = false;
            } else {
              js += ", ";
            }
            js += `"${top.attrName}": `;
            top.attrName = "";
            top.attrVal = true;
            return js;
          }

          top.attrName += char;
          return js;
        }

        if (char == ">") {
          stack.pop();
          if (top.closing) {
            stack.pop();
            return js;
          }

          js += " }";
          js = js.replace(/\{  \}$/, "null");
          if (jsx[i - 1] == "/") {
            return js + ")";
          }

          stack.push({ type: "html", text: "", newline: false });
          return js;
        }

        if (!char.match(WHITESPACE) && char != "/") {
          top.attrName += char;
          return js;
        }

        return js;
      }

      if (char == "/" && jsx[i + 1] == "/") {
        stack.push({ type: "comment" });
        return js;
      }

      if (char == "<" && js.trim().match(EXPRESSION)) {
        stack.push({
          type: "tag",
          name: "",
          named: false,
          closing: null,
          attrName: "",
          attrVal: false,
          fattr: true,
        });
        return js;
      }

      if (
        char == '"' ||
        char == "'" ||
        char == "`" ||
        (char == "/" && js.trim().match(EXPRESSION))
      ) {
        stack.push({ type: "string", char, esc: false, lesc: false });
        return js + char;
      }

      if (char == "{") {
        stack.push({ type: null });
        return js + char;
      }

      if (char == "}") {
        stack.pop();
        return js + (top.close ?? char);
      }

      return js + char;
    }, "")
  );
}
