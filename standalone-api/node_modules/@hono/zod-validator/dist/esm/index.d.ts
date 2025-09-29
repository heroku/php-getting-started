import type { Context, MiddlewareHandler, Env, ValidationTargets, TypedResponse, Input } from 'hono';
import type { z, ZodError } from 'zod';
export type Hook<T, E extends Env, P extends string, O = {}> = (result: {
    success: true;
    data: T;
} | {
    success: false;
    error: ZodError;
    data: T;
}, c: Context<E, P>) => Response | void | TypedResponse<O> | Promise<Response | void | TypedResponse<O>>;
type HasUndefined<T> = undefined extends T ? true : false;
export declare const zValidator: <T extends z.ZodType<any, z.ZodTypeDef, any>, Target extends keyof ValidationTargets, E extends Env, P extends string, In = z.input<T>, Out = z.output<T>, I extends Input = {
    in: HasUndefined<In> extends true ? { [K in Target]?: (K extends "json" ? In : HasUndefined<keyof ValidationTargets[K]> extends true ? { [K2 in keyof In]?: ValidationTargets[K][K2] | undefined; } : { [K2_1 in keyof In]: ValidationTargets[K][K2_1]; }) | undefined; } : { [K_1 in Target]: K_1 extends "json" ? In : HasUndefined<keyof ValidationTargets[K_1]> extends true ? { [K2_2 in keyof In]?: ValidationTargets[K_1][K2_2] | undefined; } : { [K2_3 in keyof In]: ValidationTargets[K_1][K2_3]; }; };
    out: { [K_2 in Target]: Out; };
}, V extends I = I>(target: Target, schema: T, hook?: Hook<z.TypeOf<T>, E, P, {}> | undefined) => MiddlewareHandler<E, P, V>;
export {};
