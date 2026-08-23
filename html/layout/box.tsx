import { jsx } from "../../jsx";
import { css } from "../css";

export interface BoxProps {
  children?: any;
  /** HTML element to render. Defaults to `div`. */
  tag?: string;

  // Margin
  m?: string;
  mb?: string;
  ml?: string;
  mr?: string;
  mt?: string;
  mx?: string;
  my?: string;

  // Padding
  p?: string;
  pb?: string;
  pl?: string;
  pr?: string;
  pt?: string;
  px?: string;
  py?: string;

  // Borders
  b?: string;
  bt?: string;
  br?: string;
  bb?: string;
  bl?: string;
  bx?: string;
  by?: string;

  // Border Radius
  r?: string;
  rt?: string;
  rr?: string;
  rb?: string;
  rl?: string;
  rtr?: string;
  rtl?: string;
  rbr?: string;
  rbl?: string;

  // Sizing
  s?: string;
  h?: string;
  w?: string;
  maxH?: string;
  maxW?: string;
  minH?: string;
  minW?: string;

  // Appearance
  o?: string;
  sh?: string;
  bg?: string;

  // Additional styles
  style?: Record<string, string | undefined>;

  // HTML attributes
  id?: string;
  class?: string;
  className?: string;
  title?: string;
  role?: string;

  [key: string]: unknown;
}

export function Box(p: BoxProps) {
  const {
    tag: Tag = "div",
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

    b,
    bt,
    br,
    bb,
    bl,
    bx,
    by,

    r,
    rt,
    rr,
    rb,
    rl,
    rtr,
    rtl,
    rbr,
    rbl,

    s,
    h,
    w,
    maxH,
    maxW,
    minH,
    minW,

    o,
    sh,
    bg,

    style: customStyle,
    children,

    ...attrs
  } = p;

  const style = css({
    marginBottom: mb ?? my ?? m,
    marginLeft: ml ?? mx ?? m,
    marginRight: mr ?? mx ?? m,
    marginTop: mt ?? my ?? m,

    paddingBottom: pb ?? py ?? padding,
    paddingLeft: pl ?? px ?? padding,
    paddingRight: pr ?? px ?? padding,
    paddingTop: pt ?? py ?? padding,

    background: bg,
    opacity: o,
    boxShadow: sh,

    borderTop: bt ?? by ?? b,
    borderRight: br ?? bx ?? b,
    borderBottom: bb ?? by ?? b,
    borderLeft: bl ?? bx ?? b,

    borderTopRightRadius: rtr ?? rt ?? rr ?? r,
    borderTopLeftRadius: rtl ?? rt ?? rl ?? r,
    borderBottomRightRadius: rbr ?? rb ?? rr ?? r,
    borderBottomLeftRadius: rbl ?? rb ?? rl ?? r,

    width: w ?? s,
    height: h ?? s,

    maxWidth: maxW,
    maxHeight: maxH,
    minWidth: minW,
    minHeight: minH,

    ...customStyle,
  });

  return jsx(Tag, { ...attrs, style: style || undefined }, ...(Array.isArray(children) ? children : [children]));
}
