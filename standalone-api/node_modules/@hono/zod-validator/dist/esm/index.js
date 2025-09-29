import { validator } from 'hono/validator';
export const zValidator = (target, schema, hook) => 
// @ts-expect-error not typed well
validator(target, async (value, c) => {
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
