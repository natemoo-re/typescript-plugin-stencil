import * as ts from 'typescript/lib/tsserverlibrary';
export declare type TagCondition = string;
export declare function findNode(sourceFile: ts.SourceFile, position: number): ts.Node | undefined;
export declare function findAllNodes(sourceFile: ts.SourceFile, cond: (n: ts.Node) => boolean): ts.Node[];
export declare function isTagged(node: ts.Node, condition: TagCondition): boolean;
