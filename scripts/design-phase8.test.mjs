import test from "node:test";
import { assertCurrentDesignContract } from "./current-design-contract.mjs";

test("shared button styles use current component variants", () => assertCurrentDesignContract("buttons"));
