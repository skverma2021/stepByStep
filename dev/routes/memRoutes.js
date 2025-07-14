const express = require('express');
const router = express.Router();
const Blockchain = require('../blockchain');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');

const nodeAddress = uuidv4().split('-').join('')
const bitcoin = new Blockchain();
console.log("Blockchain initialized and Genesis Block created: ", bitcoin)

router.get('/blockchain', (req, res) => {
  res.send(bitcoin)
});

// create a new transaction
router.post('/transaction', function(req, res) {
	const newTransaction = req.body;
	const blockIndex = bitcoin.addTransactionToPendingTransactions(newTransaction);
	res.json({ note: `Transaction will be added in block ${blockIndex}.` });
});

router.post('/transaction/broadcast', async function (req, res) {
	try {
		// Create a new transaction
		const newTransaction = bitcoin.createNewTransaction(
			req.body.amount,
			req.body.sender,
			req.body.recipient
		);

		// Add the transaction to the current node's pending transactions
		bitcoin.addTransactionToPendingTransactions(newTransaction);

		// Prepare POST requests to all other nodes in the network
		const broadcastPromises = bitcoin.networkNodes.map(networkNodeUrl => {
      // console.log(networkNodeUrl + '/transaction')
			return axios.post(networkNodeUrl + '/transaction', newTransaction);
		});

		// Wait for all requests to finish
		await Promise.all(broadcastPromises);

		res.json({ note: 'Transaction created and broadcast successfully.' });
	} catch (error) {
		console.error('Broadcast failed:', error.message);
		res.status(500).json({ note: 'Transaction broadcast failed.', error: error.message });
	}
});

// nonce, prevBlockHash, hash
router.get('/mine', async function (req, res) {
  try {
    const lastBlock = bitcoin.getLastBlock();
    const previousBlockHash = lastBlock.hash;

    const currentBlockData = {
      transactions: bitcoin.pendingTransactions,
      index: lastBlock.index + 1
    };

    const nonce = bitcoin.proofOfWork(previousBlockHash, currentBlockData);
    const blockHash = bitcoin.hashBlock(previousBlockHash, currentBlockData, nonce);
    const newBlock = bitcoin.createNewBlock(nonce, previousBlockHash, blockHash);

    // Broadcast the new block to all other nodes
    const broadcastPromises = bitcoin.networkNodes.map(networkNodeUrl => {
      return axios.post(networkNodeUrl + '/receive-new-block', {
        newBlock: newBlock
      });
    });

    await Promise.all(broadcastPromises);

    // Reward the miner by broadcasting a new transaction
    await axios.post(bitcoin.currentNodeUrl + '/transaction/broadcast', {
      amount: 12.5,
      sender: "00",
      recipient: nodeAddress
    });

    res.json({
      note: "New block mined & broadcast successfully",
      block: newBlock
    });
  } catch (error) {
    console.error('Mining failed:', error.message);
    res.status(500).json({ note: 'Block mining failed.', error: error.message });
  }
});

// receive new block
router.post('/receive-new-block', function(req, res) {
	const newBlock = req.body.newBlock;
	const lastBlock = bitcoin.getLastBlock();
	const correctHash = lastBlock.hash === newBlock.previousBlockHash; 
	const correctIndex = lastBlock['index'] + 1 === newBlock['index'];

	if (correctHash && correctIndex) {
		bitcoin.chain.push(newBlock);
		bitcoin.pendingTransactions = [];
		res.json({
			note: 'New block received and accepted.',
			newBlock: newBlock
		});
	} else {
		res.json({
			note: 'New block rejected.',
			newBlock: newBlock
		});
	}
});

router.post('/register-and-broadcast-node', async function (req, res) {
  try {
    const newNodeUrl = req.body.newNodeUrl;
    
    // console.log(newNodeUrl)

    // Avoid duplicate entries
    if (bitcoin.networkNodes.indexOf(newNodeUrl) === -1 && bitcoin.currentNodeUrl !== newNodeUrl) {
      bitcoin.networkNodes.push(newNodeUrl);
      // console.log(bitcoin.networkNodes)
    }
    
    // Register the new node with all existing nodes
    const regNodesPromises = bitcoin.networkNodes.map(networkNodeUrl => {
      // console.log(networkNodeUrl + '/register-node', {newNodeUrl: newNodeUrl} );
      return axios.post(networkNodeUrl + '/register-node', {newNodeUrl: newNodeUrl});
    });
    
    await Promise.all(regNodesPromises);
    // console.log('reached here')
    
    // Send bulk registration back to the new node
    await axios.post(newNodeUrl + '/register-nodes-bulk', {
      allNetworkNodes: [...bitcoin.networkNodes, bitcoin.currentNodeUrl]
    });

    res.json({ note: 'New node registered with network successfully.' });
  } catch (error) {
    console.error('Node registration failed:', error.message);
    res.status(500).json({ note: 'Node registration failed.', error: error.message });
  }
});

// register a node with the network
router.post('/register-node', function (req, res) {
  const newNodeUrl = req.body.newNodeUrl;
  const nodeNotAlreadyPresent = bitcoin.networkNodes.indexOf(newNodeUrl) == -1;
  const notCurrentNode = bitcoin.currentNodeUrl !== newNodeUrl;
  if (nodeNotAlreadyPresent && notCurrentNode) bitcoin.networkNodes.push(newNodeUrl);
  res.json({ note: 'New node registered successfully.' });
});

// register multiple nodes at once
router.post('/register-nodes-bulk', function (req, res) {
  const allNetworkNodes = req.body.allNetworkNodes;
  allNetworkNodes.forEach(networkNodeUrl => {
    const nodeNotAlreadyPresent = bitcoin.networkNodes.indexOf(networkNodeUrl) == -1;
    const notCurrentNode = bitcoin.currentNodeUrl !== networkNodeUrl;
    if (nodeNotAlreadyPresent && notCurrentNode) bitcoin.networkNodes.push(networkNodeUrl);
  });

  res.json({ note: 'Bulk registration successful.' });
});

// Consensus
router.get('/consensus', async function (req, res) {
  try {
    // Fetch the blockchain data from all network peers
    const requestPromises = bitcoin.networkNodes.map(networkNodeUrl =>
      axios.get(networkNodeUrl + '/blockchain')
    );

    const responses = await Promise.all(requestPromises);
    const blockchains = responses.map(response => response.data);

    const currentChainLength = bitcoin.chain.length;
    let maxChainLength = currentChainLength;
    let newLongestChain = null;
    let newPendingTransactions = null;

    // Find the longest valid chain among peers
    blockchains.forEach(blockchain => {
      if (blockchain.chain.length > maxChainLength) {
        maxChainLength = blockchain.chain.length;
        newLongestChain = blockchain.chain;
        newPendingTransactions = blockchain.pendingTransactions;
      }
    });

    // Decide whether to replace the chain
    if (!newLongestChain || !bitcoin.chainIsValid(newLongestChain)) {
      res.json({
        note: 'Current chain has not been replaced.',
        chain: bitcoin.chain
      });
    } else {
      bitcoin.chain = newLongestChain;
      bitcoin.pendingTransactions = newPendingTransactions;
      res.json({
        note: 'This chain has been replaced.',
        chain: bitcoin.chain
      });
    }
  } catch (error) {
    console.error('Consensus error:', error.message);
    res.status(500).json({ note: 'Consensus failed.', error: error.message });
  }
});

// get block by blockHash
router.get('/block/:blockHash', function(req, res) { 
	const blockHash = req.params.blockHash;
	const correctBlock = bitcoin.getBlock(blockHash);
	res.json({
		block: correctBlock
	});
});

// get transaction by transactionId
router.get('/transaction/:transactionId', function(req, res) {
	const transactionId = req.params.transactionId;
	const trasactionData = bitcoin.getTransaction(transactionId);
	res.json({
		transaction: trasactionData.transaction,
		block: trasactionData.block
	});
});

// get address by address
router.get('/address/:address', function(req, res) {
	const address = req.params.address;
	const addressData = bitcoin.getAddressData(address);
	res.json({
		addressData: addressData
	});
});

// block explorer
// router.get('/block-explorer', function(req, res) {
// 	res.sendFile('./block-explorer/index.html', { root: __dirname });
// });


module.exports = router;