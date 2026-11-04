import test from "node:test";
import { assertCurrentDesignContract } from "./current-design-contract.mjs";

test("interactive UI preserves focus and reduced-motion behavior", () => assertCurrentDesignContract("accessibility"));
