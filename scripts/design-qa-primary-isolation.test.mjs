import test from "node:test";
import { assertCurrentDesignContract } from "./current-design-contract.mjs";

test("primary actions preserve the shared button contract", () => assertCurrentDesignContract("buttons"));
test("browser QA still checks rendered semantic colors", () => assertCurrentDesignContract("browser-qa"));
test("browser QA sets dark mode after the document root exists", () => assertCurrentDesignContract("dark-mode-qa"));
test("responsive layouts honor reduced-motion preferences", () => assertCurrentDesignContract("responsive"));
test("site photography uses optimized Next image components", () => assertCurrentDesignContract("images"));
