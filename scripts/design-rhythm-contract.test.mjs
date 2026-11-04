import test from "node:test";
import { assertCurrentDesignContract } from "./current-design-contract.mjs";

test("typographic and spacing rhythm use shared tokens", () => assertCurrentDesignContract("spacing"));
