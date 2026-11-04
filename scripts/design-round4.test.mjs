import test from "node:test";
import { assertCurrentDesignContract } from "./current-design-contract.mjs";

test("client billing exposes installment details in shared tables", () => assertCurrentDesignContract("client"));
test("buttons preserve current shared variants", () => assertCurrentDesignContract("buttons"));
test("semantic colors and tokens match the active snapshot", () => assertCurrentDesignContract("canonical"));
