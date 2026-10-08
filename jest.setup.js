/* eslint-disable @typescript-eslint/no-require-imports */
import '@testing-library/jest-dom';

const nodeUtil = require('node:util');
global.TextEncoder ??= nodeUtil.TextEncoder;
global.TextDecoder ??= nodeUtil.TextDecoder;

const webStreams = require('node:stream/web');
global.ReadableStream ??= webStreams.ReadableStream;
global.WritableStream ??= webStreams.WritableStream;
global.TransformStream ??= webStreams.TransformStream;
global.TextEncoderStream ??= webStreams.TextEncoderStream;
global.TextDecoderStream ??= webStreams.TextDecoderStream;

const nodeV8 = require('node:v8');
global.structuredClone ??= (value) => nodeV8.deserialize(nodeV8.serialize(value));

const web = require('next/dist/compiled/@edge-runtime/primitives');
global.fetch ??= web.fetch;
global.Request ??= web.Request;
global.Response ??= web.Response;
global.Headers ??= web.Headers;

jest.mock('next/server', () => ({
  NextRequest: global.Request,
  NextResponse: {
    json: (data, init) => new global.Response(JSON.stringify(data), {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    }),
    text: (data, init) => new global.Response(data, init),
  },
}));
