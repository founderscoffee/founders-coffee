declare module 'harfbuzzjs/hb.js' {
  const createHarfBuzz: (options: Record<string, unknown>) => Promise<unknown>;
  export default createHarfBuzz;
}
declare module 'harfbuzzjs/hbjs.js' {
  const hbjs: (instance: unknown) => unknown;
  export default hbjs;
}
declare module 'harfbuzzjs/hb.wasm' {
  const wasm: WebAssembly.Module;
  export default wasm;
}
declare module 'satori/yoga.wasm' {
  const wasm: WebAssembly.Module;
  export default wasm;
}
