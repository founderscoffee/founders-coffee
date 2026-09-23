import harfbuzzWasm from 'harfbuzzjs/hb.wasm';

type EmscriptenInstance = { readonly exports: WebAssembly.Exports };

type MutableGlobals = Record<string, unknown>;

const SCRIPT_URL = 'file:///harfbuzzjs/hb.js';
const SCRIPT_DIRECTORY = 'file:///harfbuzzjs/';
const BORROWED_GLOBALS = ['__filename', '__dirname'];

const NULL_FUNCTION_POINTER = 0;
const BLOB_DESTRUCTOR_SIGNATURE = 'vi';

/**
 * Hand emscripten a module it did not compile.
 *
 * Its loader compiles the `.wasm` from bytes, which a Worker refuses outright — `Wasm code
 * generation disallowed by embedder` — because a Worker's modules are compiled when it is
 * deployed, not while it is serving. The bytes arrive here already compiled, which
 * `new WebAssembly.Instance` accepts, and `instantiateWasm` is emscripten's documented seam for
 * supplying one.
 */
const instantiate = (
  imports: WebAssembly.Imports,
  onReady: (instance: EmscriptenInstance, module: WebAssembly.Module) => void,
): WebAssembly.Exports => {
  const module = harfbuzzWasm as unknown as WebAssembly.Module;
  const instance = new WebAssembly.Instance(module, imports);
  onReady(instance, module);
  return instance.exports;
};

/**
 * The same module, with the one call that cannot work here answered differently.
 *
 * To let HarfBuzz call back into JavaScript, emscripten's `addFunction` assembles a two-line
 * WebAssembly module at run time and compiles it — the very thing a Worker forbids. It is
 * unreachable by any other route: a plain JavaScript function cannot be placed in a `funcref`
 * table, so the generated trampoline is the only way to produce one.
 *
 * Satori needs exactly one callback, and does not need it to do anything. It shapes with
 * `createBlob`, `createFace`, `createFont` and `shape`, and takes glyph outlines from
 * opentype.js rather than from HarfBuzz, so the only function it ever registers is the destructor
 * `hb_blob_create` calls to release the copy of the font it was handed. HarfBuzz documents that
 * argument as nullable, and a null one costs one font's worth of bytes left in the WebAssembly
 * heap — per font, per isolate, four times over the life of one, because satori keeps the face it
 * builds. Anything else asking for a callback is a satori that has started drawing glyphs itself,
 * which this cannot serve; it says so rather than handing back a pointer that would trap when
 * called.
 */
const withoutGeneratedTrampolines = (emscripten: object): object => {
  const patched = Object.create(emscripten) as MutableGlobals;
  patched.addFunction = (_fn: unknown, signature: string): number => {
    if (signature !== BLOB_DESTRUCTOR_SIGNATURE) {
      throw new Error(`harfbuzz callback ${signature} needs runtime wasm`);
    }
    return NULL_FUNCTION_POINTER;
  };
  return patched;
};

/**
 * HarfBuzz, brought up the four ways a Worker requires.
 *
 * Satori shapes Arabic with HarfBuzz, which ships as an emscripten bundle written for a browser.
 * Two of its assumptions are false inside a Worker and each is fatal on the line that makes it;
 * `instantiate` and `withoutGeneratedTrampolines` above answer the two about WebAssembly.
 *
 * The other is where it was loaded from, which it wants so it can find the `.wasm` beside itself.
 * Every way it knows of asking is missing here: a Worker answers its test for a web worker
 * (`WorkerGlobalScope` exists) but has no `location`, and answers its test for Node
 * (`nodejs_compat` supplies `process.versions.node`) but has no `__dirname`, so whichever branch
 * it takes it reads a property off undefined. The address only ever locates a file `instantiate`
 * has already supplied, so a made-up one serves, and it is a `file:` URL because the worker branch
 * parses it with `new URL`. The names are defined for as long as the import takes and removed
 * again, rather than left standing where another library could read `__dirname` and conclude it is
 * running under Node. That is why the loader is imported here rather than at the top: a static
 * import would evaluate before any statement could run.
 *
 * Aliased over the bare `harfbuzzjs` specifier for the server build, because satori imports it by
 * name and offers no way to pass one in. Editing this file is not enough to see the change in the
 * dev server: Vite pre-bundles it into satori's own chunk, and that chunk is only rebuilt when
 * `apps/ui/node_modules/.vite` is deleted. Excluding satori from pre-bundling instead leaves the
 * CommonJS loaders below untransformed, and the card falls back to the house picture.
 */
const load = async (): Promise<unknown> => {
  const globals = globalThis as MutableGlobals;
  const borrowed = BORROWED_GLOBALS.filter((name) => !(name in globals));
  if (borrowed.includes('__filename')) globals.__filename = SCRIPT_URL;
  if (borrowed.includes('__dirname')) globals.__dirname = SCRIPT_DIRECTORY;
  try {
    const [loader, wrapper] = await Promise.all([
      import('harfbuzzjs/hb.js'),
      import('harfbuzzjs/hbjs.js'),
    ]);
    const emscripten = (await loader.default({
      instantiateWasm: instantiate,
    })) as object;
    return wrapper.default(withoutGeneratedTrampolines(emscripten));
  } finally {
    for (const name of borrowed) delete globals[name];
  }
};

export default load();
