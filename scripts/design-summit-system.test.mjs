import test from "node:test";
import { assertCurrentDesignContract } from "./current-design-contract.mjs";

test("public marketing pages use the active shared hero", () => assertCurrentDesignContract("marketing"));
