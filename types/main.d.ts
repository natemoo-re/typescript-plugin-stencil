import * as ts_module from "typescript/lib/tsserverlibrary";
declare function init(modules: {
    typescript: typeof ts_module;
}): {
    create: (info: ts_module.server.PluginCreateInfo) => ts_module.LanguageService;
};
export = init;
