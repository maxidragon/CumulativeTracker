import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(cleanup);

// jsdom has no layout, so it leaves scrollIntoView out.
Element.prototype.scrollIntoView = () => undefined;
