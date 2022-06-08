const axios = require('axios')
const Web3 = require('web3');
const fs = require('fs')

var WSWEB3 = 'ws://localhost:8546'
var HTTPSWEB3 = 'http://localhost:8545'

var web3 = new Web3(Web3.givenProvider || WSWEB3);

const timer = ms => new Promise(res => setTimeout(res, ms))

var lastBlockNum = 0

async function getBlockTxCount(lastStartingTime){

    try {
        await web3.eth.net.isListening()
    } catch (error) {
        console.log('ERR : ' + error+'\n')
        await timer(1500)
        web3 = new Web3(Web3.givenProvider || WSWEB3);
        return
    }

    var blockNum = await web3.eth.getBlockNumber()
    if(lastBlockNum!==blockNum){
        lastBlockNum = blockNum
        var block = await web3.eth.getBlock(blockNum)
        var blockMiner = await getBlockValidator(blockNum)
        console.log(blockNum , " : ",block.transactions.length)
        var txpoolStats = await getTxPoolStatus()
        var blockS = {
            blockNumber : blockNum,
            timestamp : block.timestamp,
            txCount : block.transactions.length,
            gasUsed : block.gasUsed,
            gasLimit : block.gasLimit,
            baseFee : block.baseFeePerGas,
            pendingTxAfterBlock : txpoolStats.pending,
            queuedTxAfterBlock : txpoolStats.queued,
            blockMiner : blockMiner
        }

        
    
        fs.appendFile(`./output/out-${lastStartingTime}.json`, '\n'+JSON.stringify(blockS) , function (err) {
            if (err) throw err;
            console.log('Added', JSON.stringify(blockS));
        });

        return blockS
    } 

}

async function getBlockValidator(blockNum){
    var blockMiner
    var hexBlockNum = '0x' + blockNum.toString(16)
    await axios.post(HTTPSWEB3 ,{
        jsonrpc: '2.0',
        method: 'bor_getAuthor',
        params: [hexBlockNum],
        id: 1
    }, {
        headers: {
        'Content-Type': 'application/json',
        },
    }).then((response) => {
        blockMiner = response.data.result
    })

    return blockMiner
}

async function getTxPoolStatus(){
    var txpoolStats = {}
    await axios.post(HTTPSWEB3 ,{
        jsonrpc: '2.0',
        method: 'txpool_status',
        params: [],
        id: 1
    }, {
        headers: {
        'Content-Type': 'application/json',
        },
    }).then((response) => {
        txpoolStats.pending = parseInt(response.data.result.pending, 16); 
        txpoolStats.queued = parseInt(response.data.result.queued, 16); 
    })

    return txpoolStats
}

async function iteration(lastStartingTime){

    while ((Math.floor(new Date().getTime() / 1000))-lastStartingTime <= 600){
        await getBlockTxCount(lastStartingTime)
        await timer(300)
    }

    return
}

async function main(){

    var lastStartingTime = Math.floor(new Date().getTime() / 1000)

    // eslint-disable-next-line no-constant-condition
    while(true){
        await iteration(lastStartingTime)
        lastStartingTime = Math.floor(new Date().getTime() / 1000)
    }

    
}

main()
