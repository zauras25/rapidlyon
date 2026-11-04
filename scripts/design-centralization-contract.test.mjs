import test from "node:test";
import { assertCurrentDesignContract } from "./current-design-contract.mjs";

test("the active token stylesheet matches its canonical snapshot", () => assertCurrentDesignContract("canonical"));
test("shared buttons use active design-system contracts", () => assertCurrentDesignContract("buttons"));
test("site navigation is styled through current shared roles", () => assertCurrentDesignContract("navigation"));
test("focus and motion preferences remain accessible", () => assertCurrentDesignContract("accessibility"));
