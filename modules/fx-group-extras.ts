export function groupList(viewPath: string) {
    const g = $$(viewPath).group();
    return g.list ? g.list() : (g.items ? g.items() : []); // adapt if your Group exposes a different name
}

export function groupMapStrings(viewPath: string, map: (it: any, idx: number) => string, sep = "\n\n") {
    const items = groupList(viewPath);
    const strs = items.map(map);
    return { concat: (s = sep) => strs.join(s) };
}
