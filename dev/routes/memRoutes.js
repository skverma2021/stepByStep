const express = require('express');
const router = express.Router();
const Blockchain = require('../blockchain');
const { v4: uuidv4 } = require('uuid');

const nodeAddress = uuidv4().split('-').join('')
const bitcoin = new Blockchain();
console.log("Blockchain initialized and Genesis Block created: ", bitcoin)

router.get('/blockchain', (req, res) => {
  res.send(bitcoin)
});

router.post('/transaction', (req, res) => {
  const blockIndex = bitcoin.createNewTransaction(req.body.amount, req.body.sender, req.body.recipient)
  res.json({ msg: `the Transaction will be added to Block Number ${blockIndex}` })
})


// nonce, prevBlockHash, hash
router.get('/mine', (req, res) => {
  const pBlock = bitcoin.getLastBlock();
  prevBlockHash = pBlock.hash;

  // Create an object that will become the new block by:
  // 1. collect all pending transaction
  // 2. compute index of the new block
  const currentBlockData =
  {
    transactions: bitcoin.pendingTransactions,
    index: pBlock.index + 1
  }
  console.log("Current block's data: (all pending transactions become new block's Transaction and index up by 1)", currentBlockData)

  // create proofOfWork - nonce (hash value) with 4 leading zeros
  nonce = bitcoin.proofOfWork(prevBlockHash, currentBlockData);
  console.log("computed proof of work: (hash that gives 4 leading zeros - based on previous block's hash and data - transactions and index)", nonce)

  // compute hash of new block which now contains proof of work
  hash = bitcoin.hashBlock(prevBlockHash, currentBlockData, nonce);
  console.log("hash of the proposed new block: (hash based on previous block's hash, data - transactions and index, and nonce)", hash)

  // creating a reward transaction
  bitcoin.createNewTransaction(12.5, "000", nodeAddress)
  console.log("Pending Transaction at this stage - with reward transaction",bitcoin.pendingTransactions)

  const newBlock = bitcoin.createNewBlock(nonce, prevBlockHash, hash);
  res.json(
    {
      note: "The newly created Block:",
      block: newBlock
    })
  console.log("ii. After creating a new block: ", bitcoin)
})
module.exports = router;