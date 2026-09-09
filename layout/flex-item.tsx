import { jsx } from "../jsx";
import { Box } from "./box";
import type { BoxProps } from "./box";

/** Controls an item's behavior inside a flex container. */
export interface FlexItemPropertiesInterface extends BoxProps {
  flx?: string;
  as?: "auto" | "flex-start" | "flex-end" | "center" | "baseline" | "stretch";
  flxGrow?: string;
  flxShrink?: string;
  flxBasis?: string;
}

export function FlexItem(p: FlexItemPropertiesInterface) {
  const {
    flx,
    as,
    flxGrow,
    flxShrink,
    flxBasis,
    style: customStyle,
    children,
    ...attrs
  } = p;

  return (
    <Box
      {...attrs}
      style={{
        flex: flx,
        alignSelf: as,
        flexGrow: flxGrow,
        flexShrink: flxShrink,
        flexBasis: flxBasis,
        ...customStyle,
      }}
    >
      {children}
    </Box>
  );
}
