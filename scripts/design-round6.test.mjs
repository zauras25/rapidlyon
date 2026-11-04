import test from "node:test";
import { assertCurrentDesignContract } from "./current-design-contract.mjs";

test("marketing pages use shared hero and brand roles", () => assertCurrentDesignContract("marketing"));
test("admin workflows use current shared table structures", () => assertCurrentDesignContract("admin"));
