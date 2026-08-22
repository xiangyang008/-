// H.264 annexb 流解析与 avcC 转换工具

/** 从 annexb 字节流中提取 NAL 单元（按 start code 分割） */
export function parseAnnexb(data: Uint8Array): Uint8Array[] {
  const nals: Uint8Array[] = []
  let i = 0
  const len = data.length

  while (i < len) {
    // 定位 start code（00 00 00 01 或 00 00 01）
    if (i + 4 <= len && data[i] === 0 && data[i + 1] === 0 && data[i + 2] === 0 && data[i + 3] === 1) {
      i += 4
    } else if (i + 3 <= len && data[i] === 0 && data[i + 1] === 0 && data[i + 2] === 1) {
      i += 3
    } else {
      i++
      continue
    }

    const nalStart = i
    // 找下一个 start code 作为 NAL 结尾
    let nalEnd = len
    for (let j = i; j < len; j++) {
      if (j + 4 <= len && data[j] === 0 && data[j + 1] === 0 && data[j + 2] === 0 && data[j + 3] === 1) {
        nalEnd = j
        break
      }
      if (j + 3 <= len && data[j] === 0 && data[j + 1] === 0 && data[j + 2] === 1) {
        nalEnd = j
        break
      }
    }

    if (nalEnd > nalStart) nals.push(data.subarray(nalStart, nalEnd))
    i = nalEnd
  }
  return nals
}

/** NAL 单元类型（byte[0] & 0x1F） */
export function nalType(nal: Uint8Array): number {
  return nal.length > 0 ? nal[0] & 0x1f : 0
}

export const NAL_SPS = 7
export const NAL_PPS = 8
export const NAL_IDR = 5

/** 从 SPS 构建 H.264 codec string（avc1.PPCCLL） */
export function avcCodecString(sps: Uint8Array): string {
  const hex = (b: number) => b.toString(16).padStart(2, '0')
  return `avc1.${hex(sps[1])}${hex(sps[2])}${hex(sps[3])}`
}

/** 从 SPS + PPS 构建 avcC description（AVCDecoderConfigurationRecord） */
export function buildAvcCDescription(sps: Uint8Array, pps: Uint8Array): Uint8Array {
  const out = new Uint8Array(11 + sps.length + pps.length)
  let o = 0
  out[o++] = 0x01 // configurationVersion
  out[o++] = sps[1] // AVCProfileIndication
  out[o++] = sps[2] // profile_compatibility
  out[o++] = sps[3] // AVCLevelIndication
  out[o++] = 0xff // lengthSizeMinusOne = 3（4 字节长度）
  out[o++] = 0xe1 // numOfSequenceParameterSets = 1
  out[o++] = (sps.length >> 8) & 0xff
  out[o++] = sps.length & 0xff
  out.set(sps, o)
  o += sps.length
  out[o++] = 0x01 // numOfPictureParameterSets = 1
  out[o++] = (pps.length >> 8) & 0xff
  out[o++] = pps.length & 0xff
  out.set(pps, o)
  o += pps.length
  return out.subarray(0, o)
}

/** 单个 NAL 转成 avcC 长度前缀格式（4 字节大端长度 + NAL） */
export function nalToAvcc(nal: Uint8Array): Uint8Array {
  const out = new Uint8Array(4 + nal.length)
  out[0] = (nal.length >> 24) & 0xff
  out[1] = (nal.length >> 16) & 0xff
  out[2] = (nal.length >> 8) & 0xff
  out[3] = nal.length & 0xff
  out.set(nal, 4)
  return out
}
