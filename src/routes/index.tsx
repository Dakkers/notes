import { createFileRoute, redirect } from "@tanstack/react-router";

// The About page doubles as the home page; `/` just redirects there.
export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: "/about" });
  },
});
