import { utils as mpUtils } from '@nomad-xyz/multi-provider';
import ethers from 'ethers';

/*
 * Encoded call to a function,
 * where to and data is encoded.
 */
export type CallData = {
  to: ethers.utils.BytesLike;
  data: ethers.utils.BytesLike;
};

/*
 * Formats function call into {to, data} struct,
 * where to and data is encoded.
 *
 * @param destinationContract - contract to be called
 * @param functionStr - name of the function
 * @param functionArgs - arguments to the call
 * @return The encoded call
 */
export function formatCall(
  destinationContract: ethers.Contract,
  functionStr: string,
  functionArgs: ReadonlyArray<unknown>,
): CallData {
  // Set up data for call message
  const func = destinationContract.interface.getFunction(functionStr);
  const data = destinationContract.interface.encodeFunctionData(
    func,
    functionArgs,
  );

  return {
    to: mpUtils.canonizeId(destinationContract.address),
    data: data,
  };
}
