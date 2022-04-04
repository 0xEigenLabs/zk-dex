// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

import "@ieigen/anonmisc/contracts/PedersenCommitment.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "./Marketplace.sol";
import "./RangeProof.sol";

import "hardhat/console.sol";

contract Bucketization is Marketplace, RangeProof {
    using Counters for Counters.Counter;
    Counters.Counter private _orderId;
    Counters.Counter private _pairId;

    PedersenCommitment _pc;

    uint256 constant private restrictedDealTime = 2;

    mapping (address => uint256[3]) private _credits; // array[0] => r || array[1] => X || array[2] => Y
    mapping (address => uint256) private _dealTimes;

    struct UnmatchedOrder {
        uint id;
        address account;
        uint256 rateCommX;
        uint256 rateCommY;
        uint buyOrSell; // 0 BUY, 1 SELL
    }

    address payable private _marketplaceAccount;

    constructor(address payable marketplaceAccount) {
        _marketplaceAccount = marketplaceAccount; // to be comfired
        _pc = new PedersenCommitment();
        _pc.setH();
    }

    UnmatchedOrder[] private _unmatchedOrders;
    mapping (uint => uint) private _orderIdToOrderIdx;

    mapping (uint => OrderPair) private _matchedPair;
    mapping (address => uint[]) private _buyerAddrToPairIds; //
    mapping (address => uint[]) private _sellerAddrToPairIds;

    function deposit(address account, uint256 r, uint256 commX, uint256 commY) public {
        (_credits[account][0], _credits[account][1], _credits[account][2]) = _pc.addCommitment(_credits[account][0], _credits[account][1], _credits[account][2], r, commX, commY);
    }

    function withdraw(address trader, uint256 commX, uint256 commY, uint v) public payable {
        require(msg.sender == trader, "B: invalid withdraw address");
        // Restrict users to withdraw cash after a certain number of transactions.
        require(_dealTimes[trader] >= restrictedDealTime, "B: not enough deals");
        require(_credits[trader][1] > 0 && _credits[trader][2] > 0, "B: account has no assets");
        require(commX == _credits[trader][1] && commY == _credits[trader][2], "B: invalid credit commitmet");
        payable(trader).transfer(v);
        delete _credits[trader];
    }

    // 3.1-3.4
    function submitOrder(address account, uint256 rateCommX, uint256 rateCommY, uint kind, uint256 upbound) public returns(uint) {
        // TODO check credit is positive, the trader needs to submit a range proof to proof his credit is enough to submit this order
        // if (kind == 0) {
        //     require(verify(a, b, c, input), "B: not enough credit");
        // }
        _orderId.increment();
        uint256 id = _orderId.current();
        _orderIdToOrderIdx[id] = _unmatchedOrders.length;
        _unmatchedOrders.push(UnmatchedOrder(id, account, rateCommX, rateCommY, kind));
        return uint(id);
    }

    // 3.10-3.12
    function attachOrderBook(uint id, Bucket memory bucket, bytes memory proof) public {
        UnmatchedOrder memory order = _unmatchedOrders[_orderIdToOrderIdx[id]];
        uint[] memory input = new uint[](2);
        input[0] = bucket.startValue;
        input[1] = bucket.startValue + bucket.width;

        // check the bucket including the rateComm
        require(verifyRangeProof(proof, input), "B: Invalid range proof");

        // TODO check the rateComm is exactly from order id

        if (order.buyOrSell == 0) {
            BuyOrders.push(Order(id, order.account, 0, order.rateCommX, order.rateCommY, bucket));
        } else {
            SellOrders.push(Order(id, order.account, 1, order.rateCommX, order.rateCommY, bucket));
        }
    }

    // 3.14-3.15
    function tradeRound() public {
        Order[] memory sortedSell = sort(SellOrders);
        Order[] memory sortedBuy = sort(BuyOrders);

        OrderPair[] memory matchedPair = matching(sortedBuy, sortedSell);

        for (uint i = 0; i < matchedPair.length; i ++) {
            _pairId.increment();
            _matchedPair[_pairId.current()] =  matchedPair[i];
            _buyerAddrToPairIds[matchedPair[i].buyOrder.trader].push(_pairId.current());
            _sellerAddrToPairIds[matchedPair[i].sellOrder.trader].push(_pairId.current());
        }
    }

    function findMatchedSeller(uint orderId, address buyerAddr) public view returns (address, int) {
        for (uint i = 0; i < _buyerAddrToPairIds[buyerAddr].length; i++) {
            uint pairId = _buyerAddrToPairIds[buyerAddr][i];
            OrderPair memory op = _matchedPair[pairId];
            if (op.buyOrder.id == orderId) {
                return (op.sellOrder.trader, int(pairId));
            }
        }
        // find nothing
        return (address(0), -1);
    }

    function findMatchedBuyer(uint orderId, address sellerAddr) public view returns (address, int) {
        for (uint i = 0; i < _sellerAddrToPairIds[sellerAddr].length; i++) {
            uint pairId = _sellerAddrToPairIds[sellerAddr][i];
            OrderPair memory op = _matchedPair[pairId];
            if (op.sellOrder.id == orderId) {
                return (op.buyOrder.trader, int(pairId));
            }
        }
        // find nothing
        return (address(0), -1);
    }

    function findPair(address seller) public view returns (uint) {
        for (uint i = 0; i < _buyerAddrToPairIds[msg.sender].length; i ++) {
            uint pairId = _buyerAddrToPairIds[msg.sender][i];
            OrderPair memory op = _matchedPair[pairId];
            if (op.sellOrder.trader == seller) {
                return pairId;
            }
        }
        // doesn't not match ever
        return 0;
    }

    // 3.17-3.22
    function confirmRound(uint256 r1, uint256 r2, uint256 fees, uint256 proofX, uint256 proofY, uint pairId, uint256 hx, uint256 hy) public payable {
        OrderPair memory pair = _matchedPair[pairId];

        // TODO check pair

        uint256 r3;
        uint256 feeCommX;
        uint256 feeCommY;
        (r3, feeCommX, feeCommY) = _pc.subCommitment(r1, pair.buyOrder.rateCommX, pair.buyOrder.rateCommY, r2, pair.sellOrder.rateCommX, pair.sellOrder.rateCommY);
        require(feeCommX == proofX && feeCommY == proofY, "B: Invalid fee comm");
        require(_pc.verifyWithH(r3, fees, feeCommX, feeCommY, hx, hy), "B: Invalid fee comm");
        debit(pair.buyOrder.trader, r1, pair.buyOrder.rateCommX, pair.buyOrder.rateCommY);
        credit(pair.sellOrder.trader, r2, pair.sellOrder.rateCommX, pair.sellOrder.rateCommY);
        _dealTimes[pair.buyOrder.trader] += 1;
        _dealTimes[pair.sellOrder.trader] += 1;
        
        // _marketplaceAccount.transfer(fees);

        // delete _matchedPair[pairId];
        // uint len = _buyerAddrToPairIds[msg.sender].length - 1;
        // for (uint i = 0; i < len; i ++) {
        //     if (pairId == _buyerAddrToPairIds[msg.sender][i]) {
        //        _buyerAddrToPairIds[msg.sender][i] = _buyerAddrToPairIds[msg.sender][len];
        //     }
        // }
        // _buyerAddrToPairIds[msg.sender].pop();

        // len = _sellerAddrToPairIds[msg.sender].length - 1;
        // for (uint i = 0; i < len; i ++) {
        //     if (pairId == _sellerAddrToPairIds[msg.sender][i]) {
        //        _sellerAddrToPairIds[msg.sender][i] = _sellerAddrToPairIds[msg.sender][len];
        //     }
        // }
        // _sellerAddrToPairIds[msg.sender].pop();
    }

    function debit(address trader, uint256 r, uint256 commX, uint256 commY) internal {
        (_credits[trader][0], _credits[trader][1], _credits[trader][2]) = _pc.subCommitment(_credits[trader][0], _credits[trader][1], _credits[trader][2], r, commX, commY);
    }

    function credit(address trader, uint256 r, uint256 commX, uint256 commY) internal {
        (_credits[trader][0], _credits[trader][1], _credits[trader][2]) = _pc.addCommitment(_credits[trader][0], _credits[trader][1], _credits[trader][2], r, commX, commY);
    }
}
