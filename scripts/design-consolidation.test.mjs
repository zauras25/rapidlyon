import test from "node:test";
import { assertCurrentDesignContract } from "./current-design-contract.mjs";

test("shared button component exposes supported variants", () => assertCurrentDesignContract("buttons"));
