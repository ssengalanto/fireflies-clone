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

if (!global.navigator.mediaDevices) {
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
