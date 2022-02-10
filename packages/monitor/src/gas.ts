// import * as contexts from "./registerContext";
// import config from './config';
//import { ethereum } from '@nomad-xyz/sdk/nomad/domains/mainnet';
import { BigNumber, ethers } from 'ethers';
import moment from 'moment';
import { plot, Plot } from 'nodeplotlib';

type AnyMap = { [key: string]: any }
type TxMap = { [key: string]: ethers.providers.TransactionResponse[] }

const agent_addresses: AnyMap = {
    celo: {
        addresses: {
            relayer: "0x8fe96fF47e0e253BF69487f36338eFB626B9ff7A",
            processor: "0xae6e2e17f7A42500A51E6b3d6e7C15D21ef44EA7"
        }
    },
    ethereum: {
        addresses: {
            updater: "0x21Da13c7748EE755bE4bd0E00C31F2b2edaFa57c",
            relayer: "0x1fdA806A25d8B0baB1f67aE32C1c835f36c804D4",
            processor: "0x673C737422b5f87B3e04Bb430699caC04aFAD760"
        }
    },
    polygon: {
        addresses: {
            relayer: "0x9b1ac3fb35DbAE3aA929Bcc9f21aa1bE40D0480f",
            processor: "0xBB0FD28512B95FF1F50fAe191e1368E5E4a07261"
        }
    }
}

let etherscan = new ethers.providers.EtherscanProvider('mainnet', 'J67H9DCRPSHVWEFTP3JNG1VP81PIM8R7UV');
let provider = new ethers.providers.AlchemyProvider('mainnet', '6mbHDw-N9UOlEu_3yOvBcrzeUoUN8f_W')
async function main () {
    const plots: Plot[] = []

    let globalFirstTx: ethers.providers.TransactionResponse | undefined = undefined;
    let globalLastTx: ethers.providers.TransactionResponse | undefined = undefined;

    const agent_txs: TxMap = {}

    // Fetch txs and search for earliest and latest txs 
    for(let agent of Object.keys(agent_addresses.ethereum.addresses)){
        const address = agent_addresses.ethereum.addresses[agent]
        const history = await etherscan.getHistory(address);
        console.log(`Got ${history.length} txs for ${agent} - ${address}`)
        //ethereum_agent_txs[agent] = history

        const firstTx = history[0]
        const lastTx = history.at(-1)!

        if(globalFirstTx === undefined || firstTx.timestamp! < globalFirstTx.timestamp!){
            //console.log("Replaced ", globalFirstTx, " with ", firstTx)
            globalFirstTx = firstTx
        }
        if(globalLastTx === undefined || lastTx.timestamp! > globalLastTx.timestamp!) {
            
            globalLastTx = lastTx
        }
        agent_txs[`Ethereum: ${agent}`] = history
    }

    for(let agent of Object.keys(agent_addresses.celo.addresses)){
        const address = agent_addresses.celo.addresses[agent]
        const history = await etherscan.getHistory(address);
        console.log(`Got ${history.length} txs for ${agent} - ${address}`)
        //ethereum_agent_txs[agent] = history

        const firstTx = history[0]
        const lastTx = history.at(-1)!

        if(globalFirstTx === undefined || firstTx.timestamp! < globalFirstTx.timestamp!){
            //console.log("Replaced ", globalFirstTx, " with ", firstTx)
            globalFirstTx = firstTx
        }
        if(globalLastTx === undefined || lastTx.timestamp! > globalLastTx.timestamp!) {
            
            globalLastTx = lastTx
        }
        agent_txs[`Celo: ${agent}`] = history
    }
    
    for(let agent of Object.keys(agent_addresses.polygon.addresses)){
        const address = agent_addresses.polygon.addresses[agent]
        const history = await etherscan.getHistory(address);
        console.log(`Got ${history.length} txs for ${agent} - ${address}`)
        //ethereum_agent_txs[agent] = history

        const firstTx = history[0]
        const lastTx = history.at(-1)!

        if(globalFirstTx === undefined || firstTx.timestamp! < globalFirstTx.timestamp!){
            //console.log("Replaced ", globalFirstTx, " with ", firstTx)
            globalFirstTx = firstTx
        }
        if(globalLastTx === undefined || lastTx.timestamp! > globalLastTx.timestamp!) {
            
            globalLastTx = lastTx
        }
        agent_txs[`Polygon: ${agent}`] = history
    }

    const globalFirstTime = moment(globalFirstTx!.timestamp! * 1000);        
    const globalLastTime = moment(globalLastTx!.timestamp! * 1000);
    
    // compute difference in days to get nBuckets 
    let difference = Math.abs(globalLastTime.valueOf() - globalFirstTime.valueOf());
    let dayDiff = Math.ceil(difference / (1000 * 3600 * 24)) + 1;

    // // (labels) make array of date labels starting from first timestamp (nBuckets long)
    const labelArray = new Array()
    const currentDay = globalFirstTime.clone();
    while (labelArray.length < dayDiff) {
        labelArray.push(currentDay.format('MMMM Do, YYYY'))
        currentDay.add(1, 'day')
    }
    for(let key of Object.keys(agent_txs)){
        console.log(`Building plot for ${key}`)
        const history = agent_txs[key]
        // (fees) make array of zeros that is nBuckets long 
        const gasArray = new Array(dayDiff).fill(BigNumber.from(0))
        // for each transaction, sum fee with value in correct date slot based on timestamp 
        const promises = history.map(async (tx) => {
            const receipt =  await provider.getTransactionReceipt(tx.hash)
            return {
                tx: tx,
                receipt:receipt
            } 
        })
        const receipts = await Promise.all(promises)

        for (let map of receipts){
            const gas = map.receipt.effectiveGasPrice.mul(map.receipt.gasUsed)
            const txTime = moment(map.tx.timestamp! * 1000);     
            
            const diff = Math.abs(txTime.valueOf() - globalFirstTime.valueOf());
            const index = Math.ceil(diff / (1000 * 3600 * 24));
            gasArray[index] = gasArray[index].add(gas)
        }
        
        const etherArray = gasArray.map((entry) => { return ethers.utils.formatEther(entry) })
        // plot it 

        const plotData: Plot = {
            x: labelArray,
            y: etherArray,
            type: 'scatter',
            name: `ETH Gas Spend - ${key}`
        }
        plots.push(plotData)
    }
    plot(plots)
}
main()


// process ethereum
// for each address
    // get list of transactions 

// process polygon
// process celo 
// for each networ
    // get a list of transactions
    // for each chunk in transactions, skip 100 for each chunk
        // for each transaction in chunk
