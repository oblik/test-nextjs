// @ts-check
import { createHandler, Handler } from "./dist/use-cache.js";

export default createHandler(Handler, {
  compress: false,
  base64: false,
});
