interface ConvertRequest {
  readonly id: number
  readonly file: File
}

type ConvertResponse =
  | { readonly id: number; readonly type: "progress"; readonly progress: number }
  | { readonly id: number; readonly type: "result"; readonly bytes: ArrayBuffer }
  | {
      readonly id: number
      readonly type: "error"
      readonly code: "no-audio" | "unsupported" | "memory" | "processing"
    }

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<ConvertRequest>) => void) | null
  postMessage: (message: ConvertResponse, transfer?: Transferable[]) => void
}

scope.onmessage = async ({ data }) => {
  let input: import("mediabunny").Input | undefined

  try {
    const [media, encoder] = await Promise.all([
      import("mediabunny"),
      import("@mediabunny/mp3-encoder"),
    ])

    encoder.registerMp3Encoder()

    input = new media.Input({
      source: new media.BlobSource(data.file),
      formats: media.ALL_FORMATS,
    })

    const audioTrack = await input.getPrimaryAudioTrack()

    if (!audioTrack) {
      scope.postMessage({ id: data.id, type: "error", code: "no-audio" })

      return
    }

    if (!(await audioTrack.canDecode())) {
      scope.postMessage({ id: data.id, type: "error", code: "unsupported" })

      return
    }

    const target = new media.BufferTarget()
    const output = new media.Output({
      format: new media.Mp3OutputFormat(),
      target,
    })
    const conversion = await media.Conversion.init({
      input,
      output,
      tracks: "primary",
      video: { discard: true },
      audio: {
        codec: "mp3",
        quality: new media.Quality({ bitrate: 192_000 }),
      },
      showWarnings: false,
    })

    if (!conversion.isValid) {
      scope.postMessage({ id: data.id, type: "error", code: "unsupported" })

      return
    }

    let lastProgress = -1

    conversion.onProgress = (progress) => {
      const percent = Math.min(100, Math.floor(progress * 100))

      if (percent !== lastProgress) {
        lastProgress = percent
        scope.postMessage({ id: data.id, type: "progress", progress: percent / 100 })
      }
    }

    await conversion.execute()

    if (!target.buffer || target.buffer.byteLength === 0) {
      scope.postMessage({ id: data.id, type: "error", code: "no-audio" })

      return
    }

    scope.postMessage({ id: data.id, type: "result", bytes: target.buffer }, [target.buffer])
  } catch (cause) {
    const message =
      cause instanceof Error ? cause.message.toLowerCase() : String(cause).toLowerCase()
    const code = /memory|allocation|out of bounds/.test(message)
      ? "memory"
      : /unsupported|not supported|decoder|codec/.test(message)
        ? "unsupported"
        : "processing"

    scope.postMessage({ id: data.id, type: "error", code })
  } finally {
    input?.dispose()
  }
}
