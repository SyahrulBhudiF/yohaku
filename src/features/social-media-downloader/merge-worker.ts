import {
  ALL_FORMATS,
  BlobSource,
  BufferTarget,
  EncodedAudioPacketSource,
  EncodedPacketSink,
  EncodedVideoPacketSource,
  Input,
  Mp4OutputFormat,
  Output,
  WebMOutputFormat,
} from "mediabunny"

import type { MergeErrorCode, MergeRequest, MergeResponse } from "./merge"

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<MergeRequest>) => void) | null
  postMessage: (message: MergeResponse, transfer?: Transferable[]) => void
}

const errorCode = (cause: unknown): Exclude<MergeErrorCode, "worker"> => {
  if (cause === "unsupported") return "unsupported"
  if (cause === "too-large") return "too-large"

  const message = cause instanceof Error ? cause.message : String(cause)

  if (/memory|allocation|too large/i.test(message)) return "too-large"
  if (/codec|unsupported|not supported/i.test(message)) return "unsupported"

  return "processing"
}

const merge = async (request: MergeRequest): Promise<ArrayBuffer> => {
  const format = request.container === "webm" ? new WebMOutputFormat() : new Mp4OutputFormat()
  const videoInput = new Input({ source: new BlobSource(request.video), formats: ALL_FORMATS })
  const audioInput = new Input({ source: new BlobSource(request.audio), formats: ALL_FORMATS })
  let output: Output<Mp4OutputFormat | WebMOutputFormat, BufferTarget> | null = null

  try {
    const videoTrack = await videoInput.getPrimaryVideoTrack()
    const audioTrack = await audioInput.getPrimaryAudioTrack()

    if (!videoTrack || !audioTrack) throw "unsupported"

    const videoCodec = await videoTrack.getCodec()
    const audioCodec = await audioTrack.getCodec()

    if (!videoCodec || !audioCodec) throw "unsupported"

    const supported = format.getSupportedCodecs()

    if (!supported.includes(videoCodec) || !supported.includes(audioCodec)) throw "unsupported"

    const videoSource = new EncodedVideoPacketSource(videoCodec)
    const audioSource = new EncodedAudioPacketSource(audioCodec)

    output = new Output({ format, target: new BufferTarget() })
    output.addVideoTrack(videoSource)
    output.addAudioTrack(audioSource)
    await output.start()

    const videoConfig = await videoTrack.getDecoderConfig()
    const audioConfig = await audioTrack.getDecoderConfig()
    const videoSink = new EncodedPacketSink(videoTrack)
    const audioSink = new EncodedPacketSink(audioTrack)
    const duration = await videoTrack.computeDuration()
    let videoPacket = await videoSink.getFirstPacket()
    let audioPacket = await audioSink.getFirstPacket()
    let videoFirst = true
    let audioFirst = true
    let lastProgress = -1

    const report = (time: number) => {
      const progress = duration > 0 ? Math.min(1, Math.max(0, time / duration)) : 0

      if (progress - lastProgress < 0.02) return

      lastProgress = progress
      scope.postMessage({ id: request.id, type: "progress", progress })
    }

    while (videoPacket || audioPacket) {
      if (videoPacket && (!audioPacket || videoPacket.timestamp <= audioPacket.timestamp)) {
        await videoSource.add(
          videoPacket,
          videoFirst ? (videoConfig ? { decoderConfig: videoConfig } : undefined) : undefined,
        )
        videoFirst = false
        report(videoPacket.timestamp)
        videoPacket = await videoSink.getNextPacket(videoPacket)
      } else if (audioPacket) {
        await audioSource.add(
          audioPacket,
          audioFirst ? (audioConfig ? { decoderConfig: audioConfig } : undefined) : undefined,
        )
        audioFirst = false
        report(audioPacket.timestamp)
        audioPacket = await audioSink.getNextPacket(audioPacket)
      }
    }

    videoSource.close()
    audioSource.close()
    await output.finalize()
    scope.postMessage({ id: request.id, type: "progress", progress: 1 })

    const buffer = output.target.buffer

    if (!buffer) throw "processing"

    return buffer
  } catch (cause) {
    if (output) await output.cancel().catch(() => undefined)

    throw cause
  } finally {
    videoInput.dispose()
    audioInput.dispose()
  }
}

scope.onmessage = async ({ data }) => {
  try {
    const bytes = await merge(data)

    scope.postMessage({ id: data.id, type: "result", bytes }, [bytes])
  } catch (cause) {
    scope.postMessage({ id: data.id, type: "error", code: errorCode(cause) })
  }
}
