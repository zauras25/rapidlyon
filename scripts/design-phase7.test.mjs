import test from "node:test";
import { assertCurrentDesignContract } from "./current-design-contract.mjs";

test("client billing uses current shared table surfaces", () => assertCurrentDesignContract("client"));
