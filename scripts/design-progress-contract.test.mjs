import test from "node:test";
import { assertCurrentDesignContract } from "./current-design-contract.mjs";

test("admin progress workflows use the shared table surface", () => assertCurrentDesignContract("admin"));
test("client project and billing surfaces use shared table styles", () => assertCurrentDesignContract("client"));
