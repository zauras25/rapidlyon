import test from "node:test";
import { assertCurrentDesignContract } from "./current-design-contract.mjs";

test("admin workflow surfaces use shared design roles", () => assertCurrentDesignContract("admin"));
