import test from "node:test";
import { assertCurrentDesignContract } from "./current-design-contract.mjs";

test("light and dark themes expose required semantic roles", () => assertCurrentDesignContract("theme"));
test("admin commercial workflows use shared table and workflow styles", () => assertCurrentDesignContract("admin"));
test("public marketing pages use the shared hero and brand roles", () => assertCurrentDesignContract("marketing"));
test("canonical token values remain synchronized", () => assertCurrentDesignContract("canonical"));
