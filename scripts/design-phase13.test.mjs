import test from "node:test";
import { assertCurrentDesignContract } from "./current-design-contract.mjs";

test("form controls use the current form and input contracts", () => assertCurrentDesignContract("forms"));
