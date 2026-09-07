// @ts-check
import { createHandler } from "./dist/createHandler.js";
import { Handler } from "./dist/use-cache.js";

export default createHandler(Handler, {
  name: "sticky",
  sticky: true,
  compress: false,
  base64: false,
});
