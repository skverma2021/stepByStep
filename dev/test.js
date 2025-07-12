const Blockchain = require('./blockchain')

const bitcoin = new Blockchain;

// bitcoin.createNewBlock(123456, 'UGVHGFDVHGF', 'FGFHJGHGFHGVHG');

// bitcoin.createNewTransaction(101, 'aaa', 'bbb');

console.log(bitcoin)

// const prevBlockHash = 'HGFFDGVHG'
// const currentBlockData = [
//     {
//         amount:100,
//         sender:'A',
//         recipient:'B'
//     },
//     {
//         amount:230,
//         sender:'B',
//         recipient:'D'
//     },
//     {
//         amount:500,
//         sender:'C',
//         recipient:'B'
//     },
// ]
// const nonce = 12356
// console.log(bitcoin.hashBlock(prevBlockHash, currentBlockData, nonce))
// console.log(bitcoin.proofOfWork(prevBlockHash, currentBlockData))
// console.log(bitcoin.hashBlock(prevBlockHash, currentBlockData, 62180))
