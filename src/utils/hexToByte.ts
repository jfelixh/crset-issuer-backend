export const calculateCallDataGasUsed = (blobDataArray: Uint8Array[]): number => {
  let nonZeroBytes = 0;
  let zeroBytes = 0;

  blobDataArray.forEach(blobData => {
    blobData.forEach(byte => {
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
}