import * as ts from "typescript/lib/tsserverlibrary";
export declare function checkType(type: ts.Type, check: (type: ts.Type) => boolean): boolean;
export declare function isBoolean(t: ts.Type): boolean;
export declare function isNumber(t: ts.Type): boolean;
export declare function isString(t: ts.Type): boolean;
