import { jsx } from "../../jsx";
import { Box } from "./box";
import type { BoxProps } from "./box";

/** Establishes a positioning context for absolute children. */
export interface RelativePropertiesInterface extends BoxProps {
  zIndex?: string;
}

export function Relative(p: RelativePropertiesInterface) {
  const { zIndex, style: customStyle, children, ...attrs } = p;

  return (
    <Box {...attrs} style={{ position: "relative", zIndex, ...customStyle }}>
      {children}
    </Box>
  );
}
