// @ts-check
import { createHandler } from "./dist/createHandler.js";
import { Handler } from "./dist/UseCacheHandler.js";

export default createHandler(Handler, {
  name: "default",
  lruSize: 1024,
  sticky: false,
  compress: false,
  base64: false,
});
