import { jsx } from "@papack/one/jsx";
import { Box, Center } from "@papack/one/layout";
import { Logo } from "../../components";
import { space } from "@papack/one/style";
import { color } from "../../style";
import { BaseTemplate } from "../../templates/base/base-template";

export function HomePage() {
  return (
    <BaseTemplate title="Homepage">
      <Center h="100dvh">
        <Box p={space["3xl"]} b={`8px dashed ${color.brand}`}>
          <Logo width="512px" height="512px" />
        </Box>
      </Center>
    </BaseTemplate>
  );
}
