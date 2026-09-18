import { jsx } from "@papack/one/jsx";
import { Text, Box, Center, Stack } from "@papack/one/layout";
import { Logo } from "../../components";
import { font, space } from "@papack/one/style";
import { color } from "../../style";
import { BaseTemplate } from "../../templates/base/base-template";

export function HomePage() {
  return (
    <BaseTemplate title="Homepage">
      <Center h="100dvh">
        <Stack g={space.xxl}>
          <Box p={space["3xl"]} class="logo-spin">
            <Logo width="512px" height="512px" />
          </Box>
          <Text
            fs={font.size["5xl"]}
            ff={font.family.sans}
            a="center"
            c={color.brand}
          >
            @papack/one
          </Text>
        </Stack>
      </Center>
    </BaseTemplate>
  );
}
