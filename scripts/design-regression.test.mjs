import test from "node:test";
import { assertCurrentDesignContract } from "./current-design-contract.mjs";

test("semantic design tokens match the active canonical snapshot", () => assertCurrentDesignContract("canonical"));
