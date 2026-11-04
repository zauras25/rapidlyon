import test from "node:test";
import { assertCurrentDesignContract } from "./current-design-contract.mjs";

test("typography follows current semantic tokens", () => assertCurrentDesignContract("typography"));
