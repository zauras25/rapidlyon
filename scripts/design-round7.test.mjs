import test from "node:test";
import { assertCurrentDesignContract } from "./current-design-contract.mjs";

test("theme contract includes the active color roles", () => assertCurrentDesignContract("theme"));
