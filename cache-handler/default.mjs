// @ts-check
import { createHandler } from "./dist/createHandler.js";
import { Handler } from "./dist/use-cache.js";

export default createHandler(Handler, {
  name: "default",
  compress: false,
  base64: false,
});
