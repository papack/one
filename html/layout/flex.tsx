import { jsx } from "../../jsx";
import { FlexItem } from "./flex-item";
import type { FlexItemPropertiesInterface } from "./flex-item";

/** Core flexbox layout primitive. */
export interface FlexPropertiesInterface extends FlexItemPropertiesInterface {
  jc?:
    | "flex-start"
    | "flex-end"
    | "center"
    | "space-between"
    | "space-around"
    | "space-evenly";
  ai?: "stretch" | "flex-start" | "flex-end" | "center" | "baseline";
  ac?:
    | "flex-start"
    | "flex-end"
    | "center"
    | "space-between"
    | "space-around"
    | "stretch";
  g?: string;
  flxDirection?: "row" | "row-reverse" | "column" | "column-reverse";
  flxWrap?: "nowrap" | "wrap" | "wrap-reverse";
  flxFlow?: `${"row" | "row-reverse" | "column" | "column-reverse"} ${"nowrap" | "wrap" | "wrap-reverse"}`;
}

export function Flex(p: FlexPropertiesInterface) {
  const {
    jc,
    ai,
    ac,
    g,
    flxDirection,
    flxWrap,
    flxFlow,
    style: customStyle,
    children,
    ...attrs
  } = p;

  return (
    <FlexItem
      {...attrs}
      style={{
        display: "flex",
        justifyContent: jc,
        alignItems: ai,
        alignContent: ac,
        gap: g,
        flexDirection: flxDirection,
        flexWrap: flxWrap,
        flexFlow: flxFlow,
        ...customStyle,
      }}
    >
      {children}
    </FlexItem>
  );
}
