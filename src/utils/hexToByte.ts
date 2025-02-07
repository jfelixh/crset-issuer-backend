/**
 * Calculates the total gas used for calldata based on zero and non-zero bytes.
 * For each byte in the blob data array:
 * - Zero bytes cost 4 gas
 * - Non-zero bytes cost 16 gas
 *
 * @param blobDataArray - Array of Uint8Arrays containing the blob data to analyze
 * @returns The total gas cost for the calldata
 *
 * @example
 * const blobData = [new Uint8Array([0, 1, 0, 2])];
 * const gasUsed = calculateCallDataGasUsed(blobData); // Returns 40 (2 zero bytes * 4 + 2 non-zero bytes * 16)
 */
export const calculateCallDataGasUsed = (
  blobDataArray: Uint8Array[]
): number => {
  let nonZeroBytes = 0;
  let zeroBytes = 0;

  blobDataArray.forEach((blobData) => {
    blobData.forEach((byte) => {
      if (byte === 0) {
        zeroBytes++;
      } else {
        nonZeroBytes++;
      }
    });
  });

  // 16 gas for non-zero bytes, 4 gas for zero bytes
  const gasUsed = nonZeroBytes * 16 + zeroBytes * 4;
  return gasUsed;
};
