/**
 * Client-environment shim for `node:stream/web` (aliased in `vite.config.ts`, `client` env only).
 * TanStack Start's streaming-SSR module (`transformStreamWithRouter`) statically imports
 * `ReadableStream` from `node:stream/web`; on the server (Workerd) that resolves to the real
 * built-in, but in the client env Vite externalizes the Node built-in and throws on access.
 *
 * Node's `stream/web` is the WHATWG Streams standard, and modern browsers ship those same
 * constructors as globals — so re-exporting the globals is a spec-correct polyfill, not a fake.
 * SSR builds keep the real `node:stream/web`.
 */
export const ReadableStream = globalThis.ReadableStream
export const ReadableStreamDefaultReader = globalThis.ReadableStreamDefaultReader
export const ReadableStreamBYOBReader = globalThis.ReadableStreamBYOBReader
export const WritableStream = globalThis.WritableStream
export const WritableStreamDefaultWriter = globalThis.WritableStreamDefaultWriter
export const WritableStreamDefaultController = globalThis.WritableStreamDefaultController
export const TransformStream = globalThis.TransformStream
export const ByteLengthQueuingStrategy = globalThis.ByteLengthQueuingStrategy
export const CountQueuingStrategy = globalThis.CountQueuingStrategy
export const TextEncoderStream = globalThis.TextEncoderStream
export const TextDecoderStream = globalThis.TextDecoderStream
