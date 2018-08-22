# Typescript Plugin: Stencil
Typescript plugin for a smoother Developer Experience within [Stencil](https://stenciljs.com) projects

## Features
- Augments code hints/hovers to include decorated type 

**Before**
```typescript
(property) MyComponent.propName: string;
(property) MyComponent.stateName: number;
(property) MyComponent.eventName: EventEmitter<any>;
(method) MyComponent.componentDidLoad(): void;
```
**After**
```typescript
(prop) MyComponent.propName: string;
(state) MyComponent.stateName: number;
(event) MyComponent.eventName: EventEmitter<any>;
(lifecycle) MyComponent.componentDidLoad(): void;
```

- Removes `hostData` and `render` from `this.` completions
- Orders `this.` completions based on Stencil [style guide](https://stenciljs.com/docs/style-guide) order rather than alphabetical. For example, states come before props, and component lifecycle methods appear in the order they are triggered.
- Adds documentation on hover/completion for builtin Stencil methods (component lifecycle hooks, `hostData`, `render`)
- Enhances `Rename Symbol` and `Find all References` to include watched props.
- Improved `options` completions for decorators (`Prop`)

### Planned Features
- CSS Completions inside of @Component({ styles: `` }) template literals (syntax highlighting would be provided by a seperate editor extension ala [vscode-styled-components](https://github.com/styled-components/vscode-styled-components))
- `hostData` completions
- JSX completions (Emmet?) for all known Stencil components (including node_modules)
- Codefixes
- Rename component (also renames file, tag, style files?)

## Installation
Install the package
```bash
npm i --save-dev typescript-plugin-stencil
```

Modify `tsconfig.json`
```json
{
    "compilerOptions": {
        ...
        "plugins": [
            { "name": "typescript-plugin-stencil" }
        ]
    }
    ...
}
```

Make sure your editor is using the Workspace version of Typescript 
#### VS Code
- Open Command Pallete (`cmd+shift+p`)
- Select `TypeScript: Select TypeScript Version.`
- Select `Use workspace version`
