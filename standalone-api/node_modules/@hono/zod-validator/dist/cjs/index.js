"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.zValidator = void 0;
const validator_1 = require("hono/validator");
const zValidator = (target, schema, hook) => 
// @ts-expect-error not typed well
(0, validator_1.validator)(target, async (value, c) => {
    const result = await schema.safeParseAsync(value);
    if (hook) {
        const hookResult = await hook({ data: value, ...result }, c);
        if (hookResult) {
            if (hookResult instanceof Response) {
                return hookResult;
            }
            if ('response' in hookResult) {
                return hookResult.response;
            }
        }
    }
    if (!result.success) {
        return c.json(result, 400);
    }
    return result.data;
});
exports.zValidator = zValidator;
