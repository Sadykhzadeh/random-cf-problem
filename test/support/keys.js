// The keys of a language's messages without the count forms. A One or Few key
// is an extra form of a bare key, and only Russian has Few forms, so the forms
// are left out when the two languages are compared.
export const baseKeys = (messages) => Object.keys(messages).filter((key) => !/(One|Few)$/.test(key)).sort()
