import * as ts from "typescript/lib/tsserverlibrary";

export function checkType(type: ts.Type, check: (type: ts.Type) => boolean): boolean {
    if (type.flags & ts.TypeFlags.Union) {
        const union = type as ts.UnionType;
        if (union.types.some(type => checkType(type, check))) {
            return true;
        }
    }
    return check(type);
}

export function isBoolean(t: ts.Type) {
    if (t) {
        return !!(t.flags & (ts.TypeFlags.Boolean | ts.TypeFlags.BooleanLike | ts.TypeFlags.BooleanLike));
    }
    return false;
}

export function isNumber(t: ts.Type) {
    if (t) {
        return !!(t.flags & (ts.TypeFlags.Number | ts.TypeFlags.NumberLike | ts.TypeFlags.NumberLiteral));
    }
    return false;
}

export function isString(t: ts.Type) {
    if (t) {
        return !!(t.flags & (ts.TypeFlags.String | ts.TypeFlags.StringLike | ts.TypeFlags.StringLiteral));
    }
    return false;
}