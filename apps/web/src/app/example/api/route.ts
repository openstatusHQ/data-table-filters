// The example's client fetches `/example/api`, which is where the registry
// block installs its handler too, so the same route works in both places.
export { GET } from "@dtf/registry/examples/infinite/api/route";

export const dynamic = "force-dynamic";
