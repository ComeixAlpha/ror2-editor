/**
 * A minimal, dependency-free XML document model for Risk of Rain 2 save files.
 *
 * Why not a real parser: the browser build uses the DOM (`DOMParser`), and that already only
 * touches the nodes it edits, so an untouched save re-serialises byte-for-byte. The tests need
 * the same guarantee under Node, which has no `DOMParser`. Writing the model by hand keeps the
 * round-trip contract explicit and testable instead of hidden inside a third-party serialiser.
 *
 * Contract: `serialize(parse(x)) === x` for any save the game writes.
 */

/** @typedef {{ type: "text", raw: string } | { type: "cdata", raw: string } | { type: "comment", raw: string } | { type: "pi", raw: string } | { type: "doctype", raw: string } | { type: "decl", raw: string } | { type: "elem", name: string, attrs: Array<{name: string, value: string, quote: string}>, children: Node[], selfClosing: boolean, rawOpen?: string }} Node */

/** An attribute, keeping the original quote character so serialisation is exact. */
export interface XmlAttribute {
  name: string;
  value: string;
  quote: string;
}

export interface XmlRawNode {
  type: "text" | "cdata" | "comment" | "pi" | "doctype" | "decl";
  /** The exact source slice, emitted verbatim on serialisation. */
  raw: string;
}

export interface XmlElement {
  type: "elem";
  name: string;
  attrs: XmlAttribute[];
  children: XmlNode[];
  selfClosing: boolean;
  /**
   * The exact source text of the opening tag, when the element came from a parsed document.
   *
   * The game writes some empty elements as `<RebirthItem />` and others as `<RebirthItem/>`, and
   * nothing else in the model records that difference. Keeping the original slice means an
   * untouched element is re-emitted byte-for-byte. It is dropped as soon as an attribute changes
   * (see `setAttribute`) so a stale slice can never be emitted.
   */
  rawOpen?: string;
}

export type XmlNode = XmlRawNode | XmlElement;

const NAME_START = /[A-Za-z_:]/;
const NAME_CHAR = /[A-Za-z0-9_:.-]/;

/**
 * Parse an XML document into a node list.
 * Throws on structural errors (mismatched or unterminated tags).
 */
export function parseXml(xml: string): XmlNode[] {
  let i = 0;
  const n = xml.length;
  const root: XmlNode[] = [];
  const stack: Array<{ node: XmlElement; name: string }> = [];
  let current: XmlNode[] = root;

  const peek = (k = 0): string => xml[i + k];
  const startsWith = (s: string): boolean => xml.startsWith(s, i);
  const fail = (msg: string): never => {
    const line = xml.slice(0, i).split("\n").length;
    throw new Error(`XML parse error at offset ${i} (line ${line}): ${msg}`);
  };

  const readName = (): string => {
    if (!NAME_START.test(xml[i] ?? "")) fail("expected a name");
    const start = i;
    while (i < n && NAME_CHAR.test(xml[i])) i++;
    return xml.slice(start, i);
  };

  const readUntil = (marker: string, what: string): void => {
    const at = xml.indexOf(marker, i);
    if (at < 0) fail(`unterminated ${what}`);
    i = at + marker.length;
  };

  while (i < n) {
    if (peek() !== "<") {
      // Text node: consume up to the next '<', including one that starts a comment/CDATA.
      const at = xml.indexOf("<!--", i);
      const lt = xml.indexOf("<", i);
      const stop = at >= 0 && (lt < 0 || at <= lt) ? at : lt;
      if (stop < 0) {
        current.push({ type: "text", raw: xml.slice(i) });
        i = n;
      } else {
        if (stop > i) current.push({ type: "text", raw: xml.slice(i, stop) });
        i = stop;
      }
      continue;
    }

    if (startsWith("<!--")) {
      const start = i;
      readUntil("-->", "comment");
      current.push({ type: "comment", raw: xml.slice(start, i) });
      continue;
    }

    if (startsWith("<![CDATA[")) {
      const start = i;
      readUntil("]]>", "CDATA section");
      current.push({ type: "cdata", raw: xml.slice(start, i) });
      continue;
    }

    if (startsWith("<?")) {
      const start = i;
      readUntil("?>", "processing instruction");
      current.push({ type: "pi", raw: xml.slice(start, i) });
      continue;
    }

    if (startsWith("<!DOCTYPE")) {
      const start = i;
      // DOCTYPE may contain a bracketed internal subset; track nesting.
      let depth = 0;
      while (i < n) {
        const c = xml[i];
        if (c === "[") depth++;
        else if (c === "]") depth--;
        else if (c === ">" && depth <= 0) {
          i++;
          break;
        }
        i++;
      }
      current.push({ type: "doctype", raw: xml.slice(start, i) });
      continue;
    }

    if (startsWith("</")) {
      i += 2;
      const name = readName();
      // Allow whitespace before the closing bracket.
      while (i < n && /\s/.test(xml[i])) i++;
      if (xml[i] !== ">") fail(`expected '>' closing </${name}>`);
      i++;
      const top = stack.pop();
      if (!top) {
        fail(`unexpected closing tag </${name}>`);
        throw new Error("unreachable");
      }
      if (top.name !== name)
        fail(`mismatched tag: <${top.name}> closed by </${name}>`);
      current = stack.length ? stack[stack.length - 1].node.children : root;
      continue;
    }

    // Element open tag.
    const tagStart = i;
    i++; // consume '<'
    const name = readName();
    const attrs: XmlAttribute[] = [];
    let selfClosing = false;

    for (;;) {
      while (i < n && /\s/.test(xml[i])) i++;
      if (i >= n) fail(`unterminated opening tag <${name}>`);

      if (xml[i] === "/") {
        i++;
        if (xml[i] !== ">") fail(`expected '>' after '/' in <${name}/>`);
        i++;
        selfClosing = true;
        break;
      }
      if (xml[i] === ">") {
        i++;
        break;
      }

      const attrName = readName();
      let ws = i;
      while (ws < n && /\s/.test(xml[ws])) ws++;
      if (xml[ws] !== "=") fail(`attribute "${attrName}" has no value`);
      i = ws + 1;
      while (i < n && /\s/.test(xml[i])) i++;
      const quote = xml[i];
      if (quote !== '"' && quote !== "'")
        fail(`attribute "${attrName}" value is not quoted`);
      i++;
      const valueStart = i;
      const end = xml.indexOf(quote, i);
      if (end < 0) fail(`unterminated value for attribute "${attrName}"`);
      const value = xml.slice(valueStart, end);
      i = end + 1;
      attrs.push({ name: attrName, value, quote });
    }

    const element: XmlElement = {
      type: "elem",
      name,
      attrs,
      children: [],
      selfClosing,
      // Remember the exact opening-tag text so `<X />` does not become `<X/>` on re-emit.
      rawOpen: xml.slice(tagStart, i),
    };
    current.push(element);
    if (!selfClosing) {
      stack.push({ node: element, name });
      current = element.children;
    }
  }

  if (stack.length) {
    throw new Error(
      `XML parse error: unclosed tag <${stack[stack.length - 1].name}>`,
    );
  }
  return root;
}

/** Escape a text node's content. */
export function escapeText(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Serialise a node list back to a string.
 * Whitespace-only text nodes and every attribute/quote style are reproduced verbatim so that an
 * unmodified document round-trips exactly.
 */
export function serializeXml(nodes: XmlNode[]): string {
  let out = "";
  for (const node of nodes) out += serializeNode(node);
  return out;
}

function serializeNode(node: XmlNode): string {
  switch (node.type) {
    case "text":
    case "cdata":
    case "comment":
    case "pi":
    case "doctype":
    case "decl":
      return node.raw;
    case "elem": {
      // A self-closing element that came from a parsed document is emitted verbatim, so
      // `<RebirthItem />` keeps its space and `<Foo/>` keeps its lack of one. `rawOpen` is only
      // absent for elements we created ourselves.
      if (node.selfClosing) {
        if (node.rawOpen !== undefined) return node.rawOpen;
        let s = "<" + node.name;
        for (const a of node.attrs) s += ` ${a.name}=${a.quote}${a.value}${a.quote}`;
        return s + "/>";
      }
      let s = "<" + node.name;
      for (const a of node.attrs) s += ` ${a.name}=${a.quote}${a.value}${a.quote}`;
      s += ">";
      for (const c of node.children) s += serializeNode(c);
      return s + `</${node.name}>`;
    }
    default: {
      const never: never = node;
      throw new Error(`unknown node type: ${JSON.stringify(never)}`);
    }
  }
}

// ---------------------------------------------------------------- query helpers

/** Element children only. */
export function childElements(node: XmlElement): XmlElement[] {
  return node.children.filter((c): c is XmlElement => c.type === "elem");
}

/** First element child with the given tag name, or undefined. */
export function findChild(
  node: XmlElement | undefined,
  name: string,
): XmlElement | undefined {
  if (!node) return undefined;
  return node.children.find(
    (c): c is XmlElement => c.type === "elem" && c.name === name,
  );
}

/** All element descendants with the given tag name, in document order. */
export function findAll(
  node: XmlElement | undefined,
  name: string,
  out: XmlElement[] = [],
): XmlElement[] {
  if (!node) return out;
  for (const c of node.children) {
    if (c.type !== "elem") continue;
    if (c.name === name) out.push(c);
    findAll(c, name, out);
  }
  return out;
}

/** Concatenated text of an element's direct text children. */
export function textOf(node: XmlElement | undefined): string {
  if (!node) return "";
  let s = "";
  for (const c of node.children) {
    if (c.type === "text") s += c.raw;
    else if (c.type === "cdata") s += c.raw.slice(9, -3);
  }
  return s;
}

/**
 * Replace an element's entire content with a single text node.
 * Raw text is escaped, matching what the game's own writer produces.
 *
 * An element that was already self-closing stays self-closing when set to an empty string, so
 * clearing an unused field does not turn `<foo/>` into `<foo></foo>`. The reverse matters just as
 * much: `<foo></foo>` must NOT become `<foo/>`, because the element's `children` may still hold
 * whitespace that its closing tag has to bracket.
 */
export function setText(node: XmlElement, value: string): void {
  const escaped = escapeText(value);
  if (escaped === "" && node.children.length === 0 && node.selfClosing) {
    // Keep the exact `<X />` vs `<X/>` form the document already used.
    node.children = [];
    return;
  }
  node.children = escaped === "" ? [] : [{ type: "text", raw: escaped }];
  node.selfClosing = false;
  // The element's form may have changed, so the cached opening tag must not be reused verbatim.
  node.rawOpen = undefined;
}

/** Set an attribute, preserving existing attribute order. */
export function setAttribute(
  node: XmlElement,
  name: string,
  value: string,
): void {
  const existing = node.attrs.find((a) => a.name === name);
  if (existing) existing.value = value;
  else node.attrs.push({ name, value, quote: '"' });
  // The cached opening-tag text no longer matches the attributes.
  node.rawOpen = undefined;
}
