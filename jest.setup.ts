import '@testing-library/jest-dom'

// jsdom does not ship a MediaRecorder or getUserMedia. Provide minimal shims
// covering only what `useRecording` calls — broader polyfills risk masking
// real bugs by passing on capabilities that don't exist in the runtime.
class MediaRecorderShim {
  start = jest.fn()
  stop = jest.fn()
  pause = jest.fn()
  resume = jest.fn()
  state: 'inactive' | 'recording' | 'paused' = 'inactive'
  ondataavailable: ((event: { data: Blob }) => void) | null = null
  onstop: (() => void) | null = null

  static isTypeSupported() {
    return true
  }
}

// @ts-expect-error -- assigning a stub to the global slot
global.MediaRecorder = MediaRecorderShim

// Radix UI (Select/Dialog/etc.) calls Element.hasPointerCapture and
// scrollIntoView during interactions. jsdom 20 doesn't ship them; without
// these stubs, opening a `<Select>` in a test silently no-ops.
if (typeof Element !== 'undefined') {
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = () => false
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = () => undefined
  }
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = () => undefined
  }
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => undefined
  }
}

// Skip the `mediaDevices` polyfill under the `node` test environment
// (API-route tests opt in via the `@jest-environment node` pragma).
if (
  typeof global.navigator !== 'undefined' &&
  !global.navigator.mediaDevices
) {
  Object.defineProperty(global.navigator, 'mediaDevices', {
    value: {
      getUserMedia: jest.fn().mockResolvedValue({
        getTracks: () => [],
      }),
    },
    configurable: true,
  })
}

// jsdom's `crypto` shim omits `randomUUID`. Back it with Node's real one so
// every call returns a fresh value — tests that need determinism stub it
// per-suite via `jest.spyOn(global.crypto, 'randomUUID')`.
import { randomUUID as nodeRandomUUID } from 'node:crypto'

if (!global.crypto?.randomUUID) {
  Object.defineProperty(global.crypto ?? (global.crypto = {} as Crypto), 'randomUUID', {
    value: () => nodeRandomUUID(),
    configurable: true,
  })
}
