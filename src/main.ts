import * as ts_module from "typescript/lib/tsserverlibrary";
import { findNode, findAllNodes } from './ts-util/index';
import { checkType, isBoolean, isNumber, isString } from './ts-util/type';
// import { doComplete } from 'vscode-emmet-helper';

interface DocumentMeta {
    className: string,
    internalProperties: string[],
    elements: string[],
    states: string[],
    propsConnect: string[],
    propsContext: string[],
    props: string[],
    watched: { prop: string, handler: string }[],
    events: string[],
    lifecycle: string[],
    listeners: { events: string[], handler: string }[],
    methods: string[],
    internalMethods: string[],
}
class StencilConstants {
    ComponentBuiltinMethods = [
        'render',
        'hostData'
    ]
    ComponentBuiltinMethodDocs = {
        'render': '\n\nReturns a tree of components that will be rendered to the DOM at runtime.',
        'hostData': '\n\nDynamically sets attributes on the host element.'
    }
    ComponentLifecycleMethods = [
        'componentWillLoad',
        'componentDidLoad',
        'componentWillUpdate',
        'componentDidUpdate',
        'componentDidUnload'
    ];
    ComponentLifecycleDocs = {
        'componentWillLoad': '\n\nThe component is about to load and it has not rendered yet.\n\nThis is the best place to make any data updates before the first render.\n\n`componentWillLoad` will only be called once.',
        'componentDidLoad': '\n\nThe component has loaded and has already rendered.\n\nUpdating data in this method will cause the component to re-render.\n\n`componentDidLoad` will only be called once.',
        'componentWillUpdate': '\n\nThe component is about to update and re-render.\n\nCalled multiple times throughout the life of the component as it updates.\n\n`componentWillUpdate` is not called on the first render.',
        'componentDidUpdate': '\n\nThe component has just re-rendered.\n\nCalled multiple times throughout the life of the component as it updates.\n\n`componentDidUpdate` is not called on the first render.',
        'componentDidUnload': '\n\nThe component did unload and the element will be destroyed.'
    }

    PropOptionsExpansion = {
        'attr': 'string',
        'context': 'string',
        'connect': 'string',
        'mutable': 'boolean',
        'reflectToAttr': 'boolean'
    }

    HostDataCompletions = [
        'class',
        'style',
        'slot',
        'aria-label'
    ]
}

function expandTo(name: string, type: 'string' | 'boolean') {
    if (type === 'string') {
        return `${name}: `;
    } else if (type === 'boolean') {
        return `${name}: true`
    }
}

function capitalizeFirst(value: string) {
    return value[0].toUpperCase() + value.slice(1);
}

const Stencil = new StencilConstants();

function init(modules: { typescript: typeof ts_module }) {
    const ts = modules.typescript;

    function create(info: ts.server.PluginCreateInfo) {
        const getNode = (fileName: string, position: number) => {
            return findNode(info.languageService.getProgram().getSourceFile(fileName), position);
        };
        const getAllNodes = (fileName: string, cond: (n: ts.Node) => boolean) => {
            const s = info.languageService.getProgram().getSourceFile(fileName);
            return findAllNodes(s, cond);
        };
        const getLineAndChar = (fileName: string, position: number) => {
            const s = info.languageService.getProgram().getSourceFile(fileName);
            return ts.getLineAndCharacterOfPosition(s, position);
        };
        const getChecker = () => {
            return info.languageService.getProgram().getTypeChecker();
        }

        const Helper = {
            getNode, getAllNodes, getLineAndChar,
            getChecker
        }

        // Get a list of things to remove from the completion list from the config object.
        // If nothing was specified, we'll just remove 'caller'
        const whatToRemove: string[] = info.config.remove || ["caller"];

        // Diagnostic logging
        info.project.projectService.logger.info(
            "[test]"
        );

        // Set up decorator
        const proxy: ts.LanguageService = Object.create(null);
        for (let k of Object.keys(info.languageService) as Array<
            keyof ts.LanguageService
            >) {
            const x = info.languageService[k];
            proxy[k] = (...args: Array<{}>) => x.apply(info.languageService, args);
        }

        const opts: ts_module.GetCompletionsAtPositionOptions = {
            triggerCharacter: '.',
            includeCompletionsForModuleExports: true
        };
        
        // Override compilerOptions to ensure experimentalDecorators is true
        info.project.setCompilerOptions(Object.assign({}, info.project.getCompilerOptions(), { "experimentalDecorators": true }))
        
        function buildStencilDecoratorDisplayParts(kind: string, arg?: string) {
            const argPart = arg ? { kind: 'text', text: arg } : null;
            return [{ kind: 'punctuation', text: '@' }, { kind: 'text', text: kind }, { kind: 'punctuation', text: '(' }, argPart, { kind: 'punctuation', text: ')' }].filter(x => x);
        }
        function buildStencilDisplayParts(kind: string) {
            return [{ kind: 'text', text: kind }];
        }

        // cachedMeta: DocumentMeta = {
            
        // }

        function hasDecoratorNamed(node: ts.Node, name: string) {
            if (!Array.isArray(node.decorators)) { return false; }
            const decorators = node.decorators;
            return Array.isArray(decorators) && decorators.find(decorator => ts.isCallExpression(decorator.expression) && ts.isIdentifier(decorator.expression.expression) && decorator.expression.expression.text === name);
        }

        function toName(member: ts.ClassElement) {
            return member.name && ts.isIdentifier(member.name) && member.name.text;
        }

        function isComponentClass(node: ts.Node): node is ts.ClassExpression {
            if (!node || !ts.isClassDeclaration(node)) { return false; }
            return Array.isArray(node.decorators) && node.decorators.some((dec) => ts.isCallExpression(dec.expression) && ts.isIdentifier(dec.expression.expression) && dec.expression.expression.text === 'Component');
        }

        type MetaCategory = 'own property' | 'element' | 'state' | 'prop' | 'prop:connect' | 'prop:context' | 'watch' | 'event' | 'lifecycle' | 'listen' | 'method' | 'local method';
        function getSortText(category: MetaCategory, name: string): string {
            const categories = ['own property', 'element', 'state', 'prop:connect', 'prop:context', 'prop', 'watch', 'event', 'lifecycle', 'listen', 'method', 'local method'];
            const letters = 'abcdefghijklmnopqrstuvwxyz'.split('');
            const i = categories.indexOf(category);
            let prefix = (i > -1) ? letters[i] : 'z';

            if (category === 'lifecycle') {
                const lifecycles = ['componentWillLoad', 'componentDidLoad', 'componentWillUpdate', 'componentDidUpdate', 'componentDidUnload']
                prefix += letters[lifecycles.indexOf(name)];
            }
            return `${prefix}-${name}`
        }
        
        function getCategory(meta: DocumentMeta, name: string): { item: any, category: MetaCategory } {
        if(meta.internalProperties.includes(name)) { return { item: name, category: 'own property' } }
            if(meta.elements.includes(name)) { return { item: name, category: 'element' } }
            if(meta.states.includes(name)) { return { item: name, category: 'state' } }
            if (meta.propsConnect.includes(name)) { return { item: name, category: 'prop:connect' } }
            if (meta.propsContext.includes(name)) { return { item: name, category: 'prop:context' } }
            if (meta.props.includes(name)) { return { item: name, category: 'prop' } }
            if(meta.watched.some(w => w.handler === name)) { return { item: meta.watched.find(w => w.handler === name), category: 'watch' } }
            if(meta.events.includes(name)) { return { item: name, category: 'event' } }
            if(meta.lifecycle.includes(name)) { return { item: name, category: 'lifecycle' } }
            if(meta.listeners.some(l => l.handler === name)) { return { item: meta.listeners.find(l => l.handler === name), category: 'listen' } }
            if(meta.methods.includes(name)) { return { item: name, category: 'method' } }
            if(meta.internalMethods.includes(name)) { return { item: name, category: 'local method' } }
        }

        function gatherDocumentMeta(sourceFile: ts.SourceFile) {
            const meta: DocumentMeta = {
                className: null,
                internalProperties: [],
                elements: [],
                states: [],
                propsConnect: [],
                propsContext: [],
                props: [],
                watched: [],
                events: [],
                lifecycle: [],
                listeners: [],
                methods: [],
                internalMethods: []
            }
            
            function visit(node: ts.Node) {
                if (ts.isClassDeclaration(node) && isComponentClass(node)) {
                    meta.className = ts.isIdentifier(node.name) && node.name.text;
                    const undecorated = node.members.filter((member) => !member.decorators);
                    const decorated = node.members.filter((member) => Array.isArray(member.decorators));

                    undecorated.forEach((member) => {
                        if (Stencil.ComponentBuiltinMethods.includes(toName(member))) return;
                        if (Stencil.ComponentLifecycleMethods.includes(toName(member))) {
                            meta.lifecycle.push(toName((member)));
                        } else if (ts.isPropertyDeclaration(member)) {
                            meta.internalProperties.push(toName(member));
                        } else if (ts.isMethodDeclaration(member)) {
                            meta.internalMethods.push(toName(member));
                        }
                    })
                    decorated.forEach((member) => {
                        if (hasDecoratorNamed(member, 'Element')) { meta.elements.push(toName(member)); }
                        if (hasDecoratorNamed(member, 'State')) { meta.states.push(toName(member)); }
                        if (hasDecoratorNamed(member, 'Watch')) {
                            const decorator = member.decorators.find((dec) => ts.isCallExpression(dec.expression) && ts.isIdentifier(dec.expression.expression) && dec.expression.expression.text === 'Watch');
                            const prop = ts.isCallExpression(decorator.expression) && ts.isStringLiteral(decorator.expression.arguments[0]) && (decorator.expression.arguments[0] as ts.StringLiteral).text;
                            meta.watched.push({ prop, handler: toName(member) });
                        }
                        if (hasDecoratorNamed(member, 'Listen')) {
                            const decorators = member.decorators.filter((dec) => ts.isCallExpression(dec.expression) && ts.isIdentifier(dec.expression.expression) && dec.expression.expression.text === 'Listen');
                            const events = decorators.map(decorator => ts.isCallExpression(decorator.expression) && ts.isStringLiteral(decorator.expression.arguments[0]) && (decorator.expression.arguments[0] as ts.StringLiteral).text);
                            meta.listeners.push({ events, handler: toName(member) });
                        }
                        if (hasDecoratorNamed(member, 'Event')) { meta.events.push(toName(member)); }
                        if (hasDecoratorNamed(member, 'Method')) { meta.methods.push(toName(member)); }
                        if (hasDecoratorNamed(member, 'Prop')) { meta.props.push(toName(member)); }
                    })
                    info.project.projectService.logger.info(`[test] undecorated "${JSON.stringify(undecorated.map(toName), null, 2)}"`);
                    info.project.projectService.logger.info(`[test] decorated "${JSON.stringify(decorated.map(toName), null, 2)}"`);

                    // meta.props.push(...decorated.filter(hasDecoratorNamed('Prop')).map(toName))
                    // meta.states.push(...decorated.filter(hasDecoratorNamed('State')).map(toName))
                    // meta.events.push(...decorated.filter(hasDecoratorNamed('Events')).map(toName));
                }
                node.forEachChild(visit);
            }
            visit(sourceFile);
            return meta;
        }

        let cachedQuickInfo = new Map<string, ts.QuickInfo>();

        proxy.findReferences = (fileName: string, position: number) => {
            const sourceFile = info.languageService.getProgram().getSourceFile(fileName);
            const meta = gatherDocumentMeta(sourceFile);
            const node = Helper.getNode(fileName, position);
            let text;
            if (ts.isIdentifier(node)) text = node.text;
            else if (ts.isPropertyDeclaration(node) && ts.isIdentifier(node.name)) text = node.name.text;

            const prior = info.languageService.findReferences(fileName, position);
            
            if (meta.watched.some(w => w.prop === text)) {
                let found: number;
                found = sourceFile.getText().indexOf(`"${text}"`);
                if (!(found > -1)) found = sourceFile.getText().indexOf(`'${text}'`);

                if (found > -1) {
                    prior.push({
                        definition: prior[0].definition,
                        references: [{
                            textSpan: { start: found + 1, length: text.length },
                            fileName: fileName,
                            isDefinition: false,
                            isWriteAccess: true,
                            isInString: true
                        }]
                    })
                }
            }

            return prior;
        }
        
        proxy.findRenameLocations = (fileName: string, position: number, findInStrings: boolean, findInComments: boolean) => {
            const sourceFile = info.languageService.getProgram().getSourceFile(fileName);
            const meta = gatherDocumentMeta(sourceFile);
            const node = Helper.getNode(fileName, position);
            let text;
            if (ts.isIdentifier(node)) text = node.text;
            else if (ts.isPropertyDeclaration(node) && ts.isIdentifier(node.name)) text = node.name.text;

            const isWatched = text && meta.watched.some(w => w.prop === text);
            
            if (isWatched) findInStrings = true;
            const prior = info.languageService.findRenameLocations(fileName, position, findInStrings, findInComments);
            if (isWatched) {
                const watcher = meta.watched.find(w => w.prop === text);
                let propReferenceIndex = watcher.handler.indexOf(text);
                // if (!(propReferenceIndex > -1)) { propReferenceIndex = watcher.handler.indexOf(capitalizeFirst(text)); }

                if (propReferenceIndex > -1) {
                    prior.push({
                        fileName: fileName,
                        textSpan: {
                            start: sourceFile.getText().indexOf(watcher.handler) + propReferenceIndex,
                            length: text.length
                        }
                    })
                }
            }

            return prior;
        }
        proxy.getQuickInfoAtPosition = (fileName: string, position: number) => {
            const node = Helper.getNode(fileName, position);
            const cacheId = `${fileName}@${node.pos}:${node.end}`;
            if (cachedQuickInfo.has(cacheId)) {
                return cachedQuickInfo.get(cacheId);
            } else {
                const prior = info.languageService.getQuickInfoAtPosition(fileName, position);
                let docs = [];
                if (prior && prior.kind === 'method') {
                    const name = prior.displayParts.find(x => x.kind === 'methodName');
                    if (name && Stencil.ComponentLifecycleMethods.includes(name.text)) {
                        if (!prior.documentation.some(x => x.text.indexOf('**Component Lifecycle Method**') > -1)) {
                            prior.documentation.push({ kind: 'markdown', text: '\n\n**Component Lifecycle Method**' + Stencil.ComponentLifecycleDocs[name.text] });
                        }
                    } else if (Stencil.ComponentBuiltinMethods.includes(name.text)) {
                        if (!prior.documentation.some(x => x.text.indexOf('**Component Method**') > -1)) {
                            prior.documentation.push({ kind: 'markdown', text: '\n\n**Component Method**' + Stencil.ComponentBuiltinMethodDocs[name.text] });
                        }
                    }
                }
                info.project.projectService.logger.info(`[test] QuickInfo "${JSON.stringify(prior, null, 2)}"`);
                
                cachedQuickInfo.set(cacheId, prior);
                return prior;
            }
        }
        
        let cachedCompletionEntryDetailsFileName: string;
        let cachedCompletionEntryDetailsPosition: number;
        let cachedCompletionEntryDetailsNames: string[];
        let cachedCompletionEntryDetails = new Map <string, ts_module.CompletionEntryDetails>();

        proxy.getCompletionEntryDetails = (fileName: string, position: number, name: string, formatOptions: ts.FormatCodeOptions, source: string, preferences: ts.UserPreferences) => {
            if (cachedCompletionEntryDetailsFileName === fileName && cachedCompletionEntryDetailsPosition === position && cachedCompletionEntryDetailsNames.includes(name)) {
                return cachedCompletionEntryDetails.get(name);
            } else {
                const sourceFile = info.languageService.getProgram().getSourceFile(fileName);
                const meta: DocumentMeta = gatherDocumentMeta(sourceFile);
                const prior = info.languageService.getCompletionEntryDetails(fileName, position, name, formatOptions, source, preferences);
                info.project.projectService.logger.info(`[test] DocumentMetadata "${JSON.stringify(meta, null, 2)}"`);
                if (prior.kind === 'property' || prior.kind === 'method') {
                    const { item, category } = getCategory(meta, name);
                    if (category === 'watch') {
                        prior.displayParts.splice(1, 1, ...buildStencilDisplayParts('watch'))
                        prior.displayParts.push({ kind: 'punctuation', text: '\n' }, { kind: 'punctuation', text: '(' }, { kind: 'text', text: 'watched' }, { kind: 'punctuation', text: ')' }, { kind: 'space', text: ' ' }, { kind: 'keyword', text: item.prop });
                    } else if (category === 'listen') {
                        let eventDisplayParts = [];
                        (item as any).events.forEach((event) => {
                            return eventDisplayParts.push(...buildStencilDecoratorDisplayParts('Watch', event), { kind: 'punctuation', text: '\n' });
                        })
                        prior.displayParts.splice(0, 4);
                        prior.displayParts.splice(0, 0, ...eventDisplayParts)
                    } else {
                        if (category === 'lifecycle') {
                            prior.documentation.push({ kind: 'markdown', text: '\n\n**Component Lifecycle Method**' + Stencil.ComponentLifecycleDocs[name] });
                        }
                        prior.displayParts.splice(1, 1, ...buildStencilDisplayParts(category))
                    }
                    info.project.projectService.logger.info(`[test] Adding Stencil Display Parts doucmentation "${JSON.stringify(prior, null, 2)}"`);
                }

                if (cachedCompletionEntryDetailsFileName === fileName && cachedCompletionEntryDetailsPosition === position) {
                    cachedCompletionEntryDetailsNames.push(name);
                    cachedCompletionEntryDetails.set(name, prior);
                } else {
                    cachedCompletionEntryDetails.clear();
                    
                    cachedCompletionEntryDetailsFileName = fileName;
                    cachedCompletionEntryDetailsPosition = position;
                    cachedCompletionEntryDetailsNames = [name];
                    cachedCompletionEntryDetails.set(name, prior);
                }
                
                return prior;
            }
        }

        // Remove specified entries from completion list
        proxy.getCompletionsAtPosition = (fileName, position) => {
            const node = Helper.getNode(fileName, position);
            const prior = info.languageService.getCompletionsAtPosition(
                fileName,
                position,
                opts
            );

            // if (node && ts.isTemplateExpression(node)) {
            //     return {
            //         isGlobalCompletion: false,
            //         isMemberCompletion: false,
            //         isNewIdentifierLocation: true,
            //         entries: ['background-image'].map(el => {
            //             // insertText.push({
            //             //     span: { start: position + `</${el}>`.length, length: 0 },
            //             //     newText: `</${el}>`
            //             // })
            //             return {
            //                 name: el,
            //                 kind: ts.ScriptElementKind.unknown,
            //                 insertText: `${el}: `
            //             }
            //         }) as ts.CompletionEntry[]
            //     }
            // }
            
            if (node && node.parent && ts.isCallExpression(node.parent) && ts.isDecorator(node.parent.parent)) {
                const decorator = ts.isIdentifier(node.parent.expression) && node.parent.expression.text;

                switch (decorator) {
                    case 'Prop':
                        if (ts.isObjectLiteralExpression(node)) {
                            prior.entries = [...prior.entries.map((entry) => {
                                entry.insertText = expandTo(entry.name, Stencil.PropOptionsExpansion[entry.name]);
                                entry.hasAction = true;
                                return entry;
                            })]
                        }
                        break;
                    case 'Event':
                        break;
                }
                // const symbol = Helper.getChecker();
                // info.project.projectService.logger.info(`[test] Symbol at node "${JSON.stringify(symbol, null, 2)}"`);

                info.project.projectService.logger.info(`[test] Inside decorator named "${decorator}"`);
                
            } else if (prior && prior.isMemberCompletion && !prior.isNewIdentifierLocation) {
                info.project.projectService.logger.info(`[test] Completing for "this."`);
                const sourceFile = info.languageService.getProgram().getSourceFile(fileName);
                const meta: DocumentMeta = gatherDocumentMeta(sourceFile);
                prior.entries = prior.entries
                    .filter((entry) => {
                        return (entry.kind === 'method')
                            ? !Stencil.ComponentBuiltinMethods.includes(entry.name)
                            : true;
                    })
                    .map((entry) => {
                        const category = getCategory(meta, entry.name);
                        if (category && category.category) {
                            entry.sortText = getSortText(category.category, entry.name)
                        }
                        // if (entry.kind === 'method' && Stencil.ComponentLifecycleMethods.includes(entry.name)) {
                        //     entry.sortText = `z-${entry.name}`;
                        //     entry.kind = ts.ScriptElementKind.indexSignatureElement
                        // }
                        return entry;
                    })
            } else if (ts.isJsxText(node)) {
                const intrinsicElements = Helper.getChecker().getJsxIntrinsicTagNamesAt(node)
                    .map((value) => value.escapedName.toString())
                    .slice(115)
                    .filter((value) => !value.startsWith('test-'));
                if (!prior) {
                    const completions: ts.CompletionInfo = {
                        isGlobalCompletion: false,
                        isMemberCompletion: false,
                        isNewIdentifierLocation: true,
                        entries: intrinsicElements.map(el => {
                            // insertText.push({
                            //     span: { start: position + `</${el}>`.length, length: 0 },
                            //     newText: `</${el}>`
                            // })
                            return {
                                name: el,
                                kind: ts.ScriptElementKind.unknown,
                                insertText: `<${el}>`
                            }
                        }) as ts.CompletionEntry[]
                    }
                    return completions;
                }
                
                info.project.projectService.logger.info(`[test] JSX Intrinsic Elements: ${JSON.stringify(intrinsicElements, null, 2)}`);
            } else if (ts.isObjectLiteralExpression(node)) {
                info.project.projectService.logger.info(`[test] Inside hostData?`);
                let insideHostData = false;
                function visit(_node: ts.Node) {
                    if (!insideHostData) {
                        info.project.projectService.logger.info(`[test] Walking AST: ${ts.SyntaxKind[_node.kind]}`);
                        insideHostData = _node && ts.isMethodDeclaration(_node) && ts.isIdentifier(_node.name) && _node.name.text === 'hostData';

                        if (_node.parent) visit(_node.parent);
                    }
                }
                visit(node);

                if (insideHostData) {
                    return {
                        isGlobalCompletion: false,
                        isMemberCompletion: true,
                        isNewIdentifierLocation: true,
                        entries: Stencil.HostDataCompletions.map(item => {
                            return {
                                name: item,
                                kind: ts.ScriptElementKind.memberVariableElement,
                                insertText: item.indexOf('-') > 0 ? `'${item}': ` : `${item}: `
                            }
                        }) as ts.CompletionEntry[]
                    }
                }
            }
            
            const oldLength = prior.entries.length;
            // Sample logging for diagnostic purposes
            if (oldLength !== prior.entries.length) {
                const entriesRemoved = oldLength - prior.entries.length;
                info.project.projectService.logger.info(
                    `Removed ${entriesRemoved} entries from the completion list`
                );
            }

            return prior;
        };

        return proxy;
    }

    return { create };
}

export = init;