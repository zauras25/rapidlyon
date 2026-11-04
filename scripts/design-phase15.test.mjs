import test from "node:test";
import { assertCurrentDesignContract } from "./current-design-contract.mjs";

test("responsive layouts honor the current accessibility contract", () => assertCurrentDesignContract("responsive"));
