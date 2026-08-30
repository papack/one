import { jsx } from "../../jsx";
import { GridItem } from "./grid-item";
import type { GridItemPropertiesInterface } from "./grid-item";

/** Core CSS Grid layout primitive. */
export interface GridPropertiesInterface extends GridItemPropertiesInterface {
  g?: string;
  ai?: "stretch" | "start" | "end" | "center" | "baseline";
  ji?: "stretch" | "start" | "end" | "center" | "baseline";
  as?:
    | "auto"
    | "normal"
    | "stretch"
    | "center"
    | "start"
    | "end"
    | "self-start"
    | "self-end"
    | "flex-start"
    | "flex-end"
    | "left"
    | "right";
  grdTemplateColumns?: string;
  grdTemplateRows?: string;
  grdTemplateAreas?: string;
  grdTemplate?: string;
  grdAutoColumns?: string;
  grdAutoRows?: string;
  grdAutoFlow?: "row" | "column" | "row dense" | "column dense";
  grd?: string;
  grdRowStart?: string;
  grdColumnStart?: string;
  grdRowEnd?: string;
  grdColumnEnd?: string;
  grdRowGap?: string;
  grdColumnGap?: string;
}

export function Grid(p: GridPropertiesInterface) {
  const {
    g,
    ai,
    ji,
    as,
    grdTemplateColumns,
    grdTemplateRows,
    grdTemplateAreas,
    grdTemplate,
    grdAutoColumns,
    grdAutoRows,
    grdAutoFlow,
    grd,
    grdRowStart,
    grdColumnStart,
    grdRowEnd,
    grdColumnEnd,
    grdRowGap,
    grdColumnGap,
    style: customStyle,
    children,
    ...attrs
  } = p;

  return (
    <GridItem
      {...attrs}
      style={{
        display: "grid",
        gap: g,
        alignItems: ai,
        justifyItems: ji,
        alignSelf: as,
        gridTemplateColumns: grdTemplateColumns,
        gridTemplateRows: grdTemplateRows,
        gridTemplateAreas: grdTemplateAreas,
        gridTemplate: grdTemplate,
        gridAutoColumns: grdAutoColumns,
        gridAutoRows: grdAutoRows,
        gridAutoFlow: grdAutoFlow,
        gridArea: grd,
        gridRowStart: grdRowStart,
        gridColumnStart: grdColumnStart,
        gridRowEnd: grdRowEnd,
        gridColumnEnd: grdColumnEnd,
        rowGap: grdRowGap,
        columnGap: grdColumnGap,
        ...customStyle,
      }}
    >
      {children}
    </GridItem>
  );
}
