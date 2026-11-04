import test from "node:test";
import { assertCurrentDesignContract } from "./current-design-contract.mjs";

test("marketing layouts support responsive and reduced-motion modes", () => assertCurrentDesignContract("responsive"));
