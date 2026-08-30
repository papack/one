import { jsx } from "../../jsx";
import { Box } from "./box";
import type { BoxProps } from "./box";

/** Controls an item's placement inside a CSS grid. */
export interface GridItemPropertiesInterface extends BoxProps {
  grdArea?: string;
  grdColumn?: string;
  grdRow?: string;
}

export function GridItem(p: GridItemPropertiesInterface) {
  const {
    grdArea,
    grdColumn,
    grdRow,
    style: customStyle,
    children,
    ...attrs
  } = p;

  return (
    <Box
      {...attrs}
      style={{
        gridArea: grdArea,
        gridColumn: grdColumn,
        gridRow: grdRow,
        ...customStyle,
      }}
    >
      {children}
    </Box>
  );
}
