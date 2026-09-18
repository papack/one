import { jsx } from "@papack/one/jsx";
import { Text, Box, Center, Stack } from "@papack/one/layout";
import { Logo } from "../../components";
import { font, space } from "@papack/one/style";
import { color } from "../../style";
import { BaseTemplate } from "../../templates/base/base-template";

export function HomePage() {
  return (
    <BaseTemplate title="Homepage">
      <Center minH="100svh" class="home-page">
        <Stack g={space.xxl} class="home-page__content">
          <Box class="home-page__logo logo-spin">
            <Logo />
          </Box>
          <Text
            fs={font.size["5xl"]}
            ff={font.family.sans}
            a="center"
            c={color.brand}
            class="home-page__title"
          >
            @papack/one
          </Text>
        </Stack>
      </Center>
    </BaseTemplate>
  );
}
