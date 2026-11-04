import test from "node:test";
import { assertCurrentDesignContract } from "./current-design-contract.mjs";

test("theme roles are available in light and dark modes", () => assertCurrentDesignContract("theme"));
