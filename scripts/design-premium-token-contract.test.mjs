import test from "node:test";
import { assertCurrentDesignContract } from "./current-design-contract.mjs";

test("premium live tokens match the canonical snapshot", () => assertCurrentDesignContract("canonical"));
