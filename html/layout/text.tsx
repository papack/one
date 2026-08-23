import { jsx } from "../../jsx";
import { css } from "../css";

/** Typographic primitive for rendering text elements. */
export interface TextPropertiesInterface {
  children?: unknown;
  tag?: "span" | "p" | "h1" | "h2" | "h3" | "h4" | "h5" | "h6";

  a?: "left" | "right" | "center" | "justify";
  ff?: string;
  fw?: string;
  fs?: string;
  lh?: string;
  ls?: string;
  s?: "normal" | "italic";
  c?: string;

  m?: string;
  mb?: string;
  ml?: string;
  mr?: string;
  mt?: string;
  mx?: string;
  my?: string;

  p?: string;
  pb?: string;
  pl?: string;
  pr?: string;
  pt?: string;
  px?: string;
  py?: string;

  bg?: string;
  style?: Record<string, string | undefined>;

  id?: string;
  class?: string;
  className?: string;
  title?: string;
  role?: string;

  [key: string]: unknown;
}

export function Text(p: TextPropertiesInterface) {
  const {
    tag: Tag = "p",
    a,
    ff,
    fw,
    fs,
    lh,
    ls,
    s,
    c,
    m,
    mb,
    ml,
    mr,
    mt,
    mx,
    my,
    p: padding,
    pb,
    pl,
    pr,
    pt,
    px,
    py,
    bg,
    style: customStyle,
    children,
    ...attrs
  } = p;

  const style = css({
    textAlign: a,
    fontFamily: ff,
    fontWeight: fw,
    fontSize: fs,
    lineHeight: lh,
    letterSpacing: ls,
    fontStyle: s,
    color: c,

    marginBottom: mb ?? my ?? m,
    marginLeft: ml ?? mx ?? m,
    marginRight: mr ?? mx ?? m,
    marginTop: mt ?? my ?? m,

    paddingBottom: pb ?? py ?? padding,
    paddingLeft: pl ?? px ?? padding,
    paddingRight: pr ?? px ?? padding,
    paddingTop: pt ?? py ?? padding,

    background: bg,
    ...customStyle,
  });

  return jsx(Tag, { ...attrs, style: style || undefined }, ...(Array.isArray(children) ? children : [children]));
}
