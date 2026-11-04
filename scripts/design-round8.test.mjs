import test from "node:test";
import { assertCurrentDesignContract } from "./current-design-contract.mjs";

test("forms retain semantic input and label styling", () => assertCurrentDesignContract("forms"));
