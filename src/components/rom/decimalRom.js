import {
  SEGMENT_BLANK,
  SEGMENT_MINUS,
  SEVEN_SEGMENT_HEX,
} from "../digitalTube";

export const DECIMAL_ROM_ADDRESS_BITS = 11;

function reverseBits(value, width = 8) {
  let result = 0;

  for (let i = 0; i < width; i++) {
    result = (result << 1) | ((value >> i) & 1);
  }

  return result;
}

export function buildDecimalDisplayContents() {
  const contents = new Array(1 << DECIMAL_ROM_ADDRESS_BITS).fill(SEGMENT_BLANK);

  for (let signed = 0; signed <= 1; signed++) {
    for (let digit = 0; digit < 4; digit++) {
      for (let value = 0; value < 256; value++) {
        const negative = signed === 1 && value > 127;
        const magnitude = negative ? 256 - value : value;

        let code;

        if (digit === 0) {
          code = SEVEN_SEGMENT_HEX[magnitude % 10];
        } else if (digit === 1) {
          code =
            magnitude >= 10
              ? SEVEN_SEGMENT_HEX[Math.floor(magnitude / 10) % 10]
              : SEGMENT_BLANK;
        } else if (digit === 2) {
          code =
            magnitude >= 100
              ? SEVEN_SEGMENT_HEX[Math.floor(magnitude / 100)]
              : SEGMENT_BLANK;
        } else {
          code = negative ? SEGMENT_MINUS : SEGMENT_BLANK;
        }

        contents[value | (digit << 8) | (signed << 10)] = reverseBits(code, 8);
      }
    }
  }

  return contents;
}
