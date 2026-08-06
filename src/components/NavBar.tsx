import { Link } from "@tanstack/react-router";
import { Flex, vars } from "@saintly-software/baritone";

const surface = vars.surface.color.primary.high.default;

export function NavBar() {
  return (
    <Flex
      render={<nav />}
      align="center"
      justify="between"
      gap="4"
      px="6"
      py="3"
      style={{
        backgroundColor: surface.bgc,
        color: surface.text,
        borderBottom: `1px solid ${surface.border}`,
      }}
    >
      <Link to="/" style={{ fontWeight: vars.text.weight.semibold }}>
        Dak's Notes
      </Link>

      <Flex align="center" gap="4">
        <Link to="/notes">Notes</Link>
        <Link to="/references">References</Link>
      </Flex>
    </Flex>
  );
}
