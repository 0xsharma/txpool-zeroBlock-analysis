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
        var pendingCountMoreThanLastBlockGasFee = 0
        lastBlockNum = blockNum

        var contentPromises = []
        contentPromises.push(web3.eth.getBlock(blockNum))
        contentPromises.push(getTxPoolContent())

        var data = await Promise.all(contentPromises)
        var block = data[0]
        var txpoolContent = data[1]

        var blockMiner = await getBlockValidator(blockNum)
        console.log(blockNum , " : ",block.transactions.length)

        // txpool calc start
        var txpoolStats = await getTxPoolStatus()
        var pending = txpoolContent.pending

        // eslint-disable-next-line no-unused-vars
        for (var [key, value] of Object.entries(pending)) {
            
            // eslint-disable-next-line no-unused-vars
            for (var [nonce, txobject] of Object.entries(value)) {
                
                var maxFeePerGas = txobject.maxFeePerGas
                var gasPriceToCheck 

                if(maxFeePerGas===undefined){
                    gasPriceToCheck = txobject.gasPrice
                    
                }else{
                    gasPriceToCheck = maxFeePerGas
                }

                gasPriceToCheck = parseInt(gasPriceToCheck, 16)
                
                if(block.baseFee!==undefined){
                    if((gasPriceToCheck-30000000000)>block.baseFee){
                        pendingCountMoreThanLastBlockGasFee += 1
                    }
                }
                
            }
        }

        // txpool calc end
        var blockS = {
            blockNumber : blockNum,
            timestamp : block.timestamp,
            txCount : block.transactions.length,
            gasUsed : block.gasUsed,
            gasLimit : block.gasLimit,
            baseFee : block.baseFeePerGas,
            pendingTxAfterBlock : txpoolStats.pending,
            queuedTxAfterBlock : txpoolStats.queued,
            pendingCountMoreThanLastBlockGasFee : pendingCountMoreThanLastBlockGasFee,
            blockMiner : blockMiner,
        }

        
    
        fs.appendFile(`./output/out-${lastStartingTime}.csv`, '\n'+
        blockS.blockNumber + ',' +
        blockS.timestamp + ',' +
        blockS.txCount + ',' +
        blockS.gasUsed + ',' +
        blockS.gasLimit + ',' +
        blockS.baseFee + ',' +
        blockS.pendingTxAfterBlock + ',' +
        blockS.queuedTxAfterBlock + ',' +
        blockS.pendingCountMoreThanLastBlockGasFee + ',' +
        blockS.blockMiner
        , function (err) {
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

async function getTxPoolContent(){
    
    var res 
    await axios.post(HTTPSWEB3 ,{
        jsonrpc: '2.0',
        method: 'txpool_content',
        params: [],
        id: 1
    }, {
        headers: {
        'Content-Type': 'application/json',
        },
    }).then((response) => {
        res = response
    })
    return res.data.result
}

async function iteration(lastStartingTime){

    while ((Math.floor(new Date().getTime() / 1000))-lastStartingTime <= 1800){
        await getBlockTxCount(lastStartingTime)
        await timer(300)
    }

    return
}

async function main(){

    var lastStartingTime = Math.floor(new Date().getTime() / 1000)
    fs.appendFile(`./output/out-${lastStartingTime}.csv`, 
    `blockNumber, timestamp, txCount, gasUsed, gasLimit, baseFee, pendingTxAfterBlock, queuedTxAfterBlock, pendingCountMoreThanLastBlockGasFee, blockMiner`
    , function (err) {
        if (err) throw err;
        console.log('Initialised');
    });

    // eslint-disable-next-line no-constant-condition
    while(true){
        await iteration(lastStartingTime)
        lastStartingTime = Math.floor(new Date().getTime() / 1000)
    }

    
}

main()
