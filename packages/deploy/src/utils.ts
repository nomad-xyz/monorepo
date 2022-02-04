import { canonizeId } from '@nomad-xyz/sdk/utils';
import * as ethers from 'ethers';

/*
 * Encoded call to a function,
 * where to and data is encoded.
 */
export type CallData = {
  to: ethers.ethers.utils.BytesLike;
  data: ethers.ethers.utils.BytesLike;
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
  functionArgs: any[],
): CallData {
  // Set up data for call message
  const func = destinationContract.interface.getFunction(functionStr);
  const data = destinationContract.interface.encodeFunctionData(
    func,
    functionArgs,
  );

  return {
    to: canonizeId(destinationContract.address),
    data: data,
  };
}
