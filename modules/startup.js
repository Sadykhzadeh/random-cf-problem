// Starts the page's loads together. Each one is started when it is given, in
// the order given, so none waits for another to finish.
export const startTogether = (loads) =>
    Object.fromEntries(Object.entries(loads).map(([name, start]) => [name, start()]))
