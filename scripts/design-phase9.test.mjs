import test from "node:test";
import { assertCurrentDesignContract } from "./current-design-contract.mjs";

test("site navigation uses the active shared layout", () => assertCurrentDesignContract("navigation"));
